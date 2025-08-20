class DeviceTester {
    constructor() {
        this.currentStream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.recordedBlob = null;
        this.permissionsGranted = false;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        // Check if permissions are already granted
        try {
            const result = await navigator.permissions.query({name: 'camera'});
            const audioResult = await navigator.permissions.query({name: 'microphone'});
            
            if (result.state === 'granted' && audioResult.state === 'granted') {
                await this.loadDevices();
            } else {
                this.showPermissionModal();
            }
        } catch (error) {
            // If permissions API is not supported, try to get media directly
            this.showPermissionModal();
        }
    }

    setupEventListeners() {
        // Permission modal
        document.getElementById('requestPermissions').addEventListener('click', () => {
            this.requestPermissions();
        });

        // Device selection
        document.getElementById('cameraSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.switchCamera(e.target.value);
            }
        });

        document.getElementById('microphoneSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.switchMicrophone(e.target.value);
            }
        });

        // Camera toggle
        document.getElementById('toggleCamera').addEventListener('click', () => {
            this.toggleCamera();
        });

        // Effect buttons
        document.querySelectorAll('.effect-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.applyEffect(e.target.closest('.effect-btn').dataset.effect);
                this.updateActiveEffect(e.target.closest('.effect-btn'));
            });
        });

        // Recording controls
        document.getElementById('recordButton').addEventListener('click', () => {
            this.toggleRecording();
        });

        document.getElementById('downloadButton').addEventListener('click', () => {
            this.downloadRecording();
        });
    }

    showPermissionModal() {
        const modal = new bootstrap.Modal(document.getElementById('permissionModal'), {
            backdrop: 'static',
            keyboard: false
        });
        modal.show();
    }

    hidePermissionModal() {
        const modalElement = document.getElementById('permissionModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }
    }

    async requestPermissions() {
        try {
            // Request both video and audio permissions
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 1280 }, 
                    height: { ideal: 720 } 
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            
            // Store the stream temporarily
            this.currentStream = stream;
            this.permissionsGranted = true;
            
            await this.loadDevices();
            this.hidePermissionModal();
            this.showSuccess('Permisos concedidos correctamente');
            
            // Show camera preview by default
            this.showVideoPreview();
            this.updateCameraButton(true);
            
            // Setup audio analyzer
            this.setupAudioAnalyzer();
            
        } catch (error) {
            this.showError('Error al obtener permisos: ' + error.message);
            console.error('Permission error:', error);
        }
    }

    async loadDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            const cameras = devices.filter(device => device.kind === 'videoinput');
            const microphones = devices.filter(device => device.kind === 'audioinput');
            
            this.populateDeviceSelect('cameraSelect', cameras, 'No hay cámaras disponibles');
            this.populateDeviceSelect('microphoneSelect', microphones, 'No hay micrófonos disponibles');
            
            console.log('Devices loaded:', { cameras: cameras.length, microphones: microphones.length });
            
        } catch (error) {
            this.showError('Error al cargar dispositivos: ' + error.message);
            console.error('Device loading error:', error);
        }
    }

    populateDeviceSelect(selectId, devices, emptyMessage) {
        const select = document.getElementById(selectId);
        select.innerHTML = '';
        
        if (devices.length === 0) {
            select.innerHTML = `<option value="">${emptyMessage}</option>`;
            return;
        }
        
        devices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Dispositivo ${index + 1}`;
            select.appendChild(option);
        });
        
        // Auto-select first device
        if (devices.length > 0) {
            select.value = devices[0].deviceId;
        }
    }

    async switchCamera(deviceId) {
        if (!deviceId || !this.permissionsGranted) return;
        
        try {
            // Stop current video tracks
            if (this.currentStream) {
                this.currentStream.getVideoTracks().forEach(track => track.stop());
            }
            
            const constraints = {
                video: {
                    deviceId: { exact: deviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: this.currentStream ? {
                    deviceId: this.currentStream.getAudioTracks()[0]?.getSettings?.().deviceId || true
                } : true
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.currentStream = stream;
            
            const video = document.getElementById('videoPreview');
            video.srcObject = this.currentStream;
            
            this.showVideoPreview();
            this.updateCameraButton(true);
            
            // Re-setup audio analyzer if needed
            if (this.currentStream.getAudioTracks().length > 0) {
                this.setupAudioAnalyzer();
            }
            
        } catch (error) {
            this.showError('Error al cambiar cámara: ' + error.message);
            console.error('Camera switch error:', error);
        }
    }

    async switchMicrophone(deviceId) {
        if (!deviceId || !this.permissionsGranted) return;
        
        try {
            // Stop current audio tracks
            if (this.currentStream) {
                this.currentStream.getAudioTracks().forEach(track => track.stop());
            }
            
            const constraints = {
                video: this.currentStream ? {
                    deviceId: this.currentStream.getVideoTracks()[0]?.getSettings?.().deviceId || true
                } : false,
                audio: {
                    deviceId: { exact: deviceId },
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.currentStream = stream;
            
            // Update video element if video tracks exist
            if (this.currentStream.getVideoTracks().length > 0) {
                const video = document.getElementById('videoPreview');
                video.srcObject = this.currentStream;
            }
            
            this.setupAudioAnalyzer();
            
        } catch (error) {
            this.showError('Error al cambiar micrófono: ' + error.message);
            console.error('Microphone switch error:', error);
        }
    }

    setupAudioAnalyzer() {
        if (!this.currentStream || this.currentStream.getAudioTracks().length === 0) return;
        
        try {
            // Clean up existing audio context
            if (this.audioContext) {
                this.audioContext.close();
            }
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(this.currentStream);
            
            this.analyser.fftSize = 512;
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            
            this.microphone.connect(this.analyser);
            this.updateAudioLevel();
            
        } catch (error) {
            console.warn('Error setting up audio analyzer:', error);
        }
    }

    updateAudioLevel() {
        if (!this.analyser || !this.dataArray) return;
        
        this.analyser.getByteFrequencyData(this.dataArray);
        
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        
        const average = sum / this.dataArray.length;
        const percentage = Math.min((average / 128) * 100, 100);
        
        const audioLevel = document.getElementById('audioLevel');
        if (audioLevel) {
            audioLevel.style.width = percentage + '%';
        }
        
        requestAnimationFrame(() => this.updateAudioLevel());
    }

    toggleCamera() {
        const video = document.getElementById('videoPreview');
        const isVisible = !video.classList.contains('d-none');
        
        if (isVisible) {
            this.hideVideoPreview();
            this.updateCameraButton(false);
        } else {
            if (this.currentStream && this.currentStream.getVideoTracks().length > 0) {
                this.showVideoPreview();
                this.updateCameraButton(true);
            } else {
                const cameraSelect = document.getElementById('cameraSelect');
                if (cameraSelect.value) {
                    this.switchCamera(cameraSelect.value);
                }
            }
        }
    }

    showVideoPreview() {
        const video = document.getElementById('videoPreview');
        const placeholder = document.getElementById('videoPlaceholder');
        
        video.classList.remove('d-none');
        placeholder.classList.add('d-none');
    }

    hideVideoPreview() {
        const video = document.getElementById('videoPreview');
        const placeholder = document.getElementById('videoPlaceholder');
        
        video.classList.add('d-none');
        placeholder.classList.remove('d-none');
    }

    updateCameraButton(isActive) {
        const button = document.getElementById('toggleCamera');
        
        if (isActive) {
            button.innerHTML = '<i class="bi bi-camera-video-fill"></i> Desactivar Cámara';
            button.className = 'btn btn-sm btn-success';
        } else {
            button.innerHTML = '<i class="bi bi-camera-video"></i> Activar Cámara';
            button.className = 'btn btn-sm btn-outline-primary';
        }
    }

    applyEffect(effect) {
        const video = document.getElementById('videoPreview');
        
        // Remove all effect classes
        video.className = video.className.replace(/effect-\w+/g, '').trim();
        
        if (effect && effect !== 'none') {
            video.classList.add(`effect-${effect}`);
        }
    }

    updateActiveEffect(activeButton) {
        // Remove active class from all buttons
        document.querySelectorAll('.effect-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        activeButton.classList.add('active');
    }

    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        try {
            if (!this.currentStream || this.currentStream.getAudioTracks().length === 0) {
                this.showError('No hay micrófono disponible para grabar');
                return;
            }
            
            // Create audio-only stream for recording
            const audioStream = new MediaStream(this.currentStream.getAudioTracks());
            
            this.recordedChunks = [];
            
            // Try different MIME types for better compatibility
            let mimeType = 'audio/webm;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/webm';
            }
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/mp4';
            }
            
            this.mediaRecorder = new MediaRecorder(audioStream, { mimeType });
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };
            
            this.mediaRecorder.start(100);
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            
            this.updateRecordingUI(true);
            this.startRecordingTimer();
            
        } catch (error) {
            this.showError('Error al iniciar grabación: ' + error.message);
            console.error('Recording start error:', error);
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.updateRecordingUI(false);
            this.stopRecordingTimer();
        }
    }

    updateRecordingUI(isRecording) {
        const button = document.getElementById('recordButton');
        const buttonText = document.getElementById('recordButtonText');
        const indicator = document.getElementById('recordingIndicator');
        
        if (isRecording) {
            button.className = 'btn btn-outline-danger';
            buttonText.textContent = 'Detener Grabación';
            indicator.classList.remove('d-none');
            button.querySelector('i').className = 'bi bi-stop-fill';
        } else {
            button.className = 'btn btn-danger';
            buttonText.textContent = 'Iniciar Grabación';
            indicator.classList.add('d-none');
            button.querySelector('i').className = 'bi bi-record-fill';
        }
    }

    startRecordingTimer() {
        const timeDisplay = document.getElementById('recordingTime');
        timeDisplay.classList.remove('d-none');
        
        this.recordingTimer = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        
        const timeDisplay = document.getElementById('recordingTime');
        timeDisplay.classList.add('d-none');
        timeDisplay.textContent = '00:00';
    }

    processRecording() {
        if (this.recordedChunks.length === 0) {
            this.showError('No se grabó audio');
            return;
        }
        
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        
        this.setupAudioPlayback(url, blob);
        this.showSuccess('Grabación completada');
    }

    setupAudioPlayback(url, blob) {
        const audio = document.getElementById('audioPlayback');
        const downloadBtn = document.getElementById('downloadButton');
        const noRecording = document.getElementById('noRecording');
        
        audio.src = url;
        audio.classList.remove('d-none');
        downloadBtn.classList.remove('d-none');
        noRecording.classList.add('d-none');
        
        // Store blob for download
        this.recordedBlob = blob;
    }

    downloadRecording() {
        if (!this.recordedBlob) {
            this.showError('No hay grabación para descargar');
            return;
        }
        
        const url = URL.createObjectURL(this.recordedBlob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        
        a.href = url;
        a.download = `grabacion-${timestamp}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        this.showSuccess('Descarga iniciada');
    }

    showError(message) {
        const alert = document.getElementById('errorAlert');
        const messageEl = document.getElementById('errorMessage');
        
        messageEl.textContent = message;
        alert.classList.remove('d-none');
        alert.classList.add('show');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            alert.classList.remove('show');
            setTimeout(() => {
                alert.classList.add('d-none');
            }, 150);
        }, 5000);
    }

    showSuccess(message) {
        // Create temporary success alert
        const alertHtml = `
            <div class="alert alert-success alert-dismissible fade show" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
                <i class="bi bi-check-circle me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = alertHtml;
        document.body.appendChild(tempDiv.firstElementChild);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            const alert = document.body.querySelector('.alert-success');
            if (alert) {
                alert.remove();
            }
        }, 3000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.deviceTester = new DeviceTester();
});

// Handle page unload to clean up streams
window.addEventListener('beforeunload', () => {
    if (window.deviceTester && window.deviceTester.currentStream) {
        window.deviceTester.currentStream.getTracks().forEach(track => track.stop());
    }
    if (window.deviceTester && window.deviceTester.audioContext) {
        window.deviceTester.audioContext.close();
    }
});