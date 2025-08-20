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
            await this.checkExistingPermissions();
        } catch (error) {
            this.showPermissionModal();
        }
    }

    async checkExistingPermissions() {
        try {
            // Try to get media to check if permissions are already granted
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            this.currentStream = stream;
            this.permissionsGranted = true;
            await this.loadDevices();
            
        } catch (error) {
            // Permissions not granted, show modal
            this.showPermissionModal();
        }
    }

    setupEventListeners() {
        // Permission modal
        const requestBtn = document.getElementById('requestPermissions');
        if (requestBtn) {
            requestBtn.addEventListener('click', async () => {
                await this.requestPermissions();
            });
        }

        // Device selection
        const cameraSelect = document.getElementById('cameraSelect');
        if (cameraSelect) {
            cameraSelect.addEventListener('change', async (e) => {
                if (e.target.value) {
                    await this.switchCamera(e.target.value);
                }
            });
        }

        const microphoneSelect = document.getElementById('microphoneSelect');
        if (microphoneSelect) {
            microphoneSelect.addEventListener('change', async (e) => {
                if (e.target.value) {
                    await this.switchMicrophone(e.target.value);
                }
            });
        }

        // Effect buttons
        document.querySelectorAll('.effect-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const effectBtn = e.target.closest('.effect-btn');
                if (effectBtn && effectBtn.dataset.effect) {
                    this.applyEffect(effectBtn.dataset.effect);
                    this.updateActiveEffect(effectBtn);
                }
            });
        });

        // Recording controls
        const recordBtn = document.getElementById('recordButton');
        if (recordBtn) {
            recordBtn.addEventListener('click', () => {
                this.toggleRecording();
            });
        }

        const downloadBtn = document.getElementById('downloadButton');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadRecording();
            });
        }
    }

    showPermissionModal() {
        const modalElement = document.getElementById('permissionModal');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement, {
                backdrop: 'static',
                keyboard: false
            });
            modal.show();
        }
    }

    hidePermissionModal() {
        const modalElement = document.getElementById('permissionModal');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) {
                modal.hide();
            }
        }
    }

    async requestPermissions() {
        try {
            console.log('Requesting permissions...');
            
            // Request both video and audio permissions
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 1280 }, 
                    height: { ideal: 720 } 
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });
            
            console.log('Permissions granted, stream obtained');
            
            // Store the stream
            this.currentStream = stream;
            this.permissionsGranted = true;
            
            // Hide modal first
            this.hidePermissionModal();
            
            // Load devices
            await this.loadDevices();
            
            // Show success message
            this.showSuccess('Permisos concedidos correctamente');
            
        } catch (error) {
            console.error('Permission error:', error);
            this.showError('Error al obtener permisos: ' + error.message);
        }
    }

    async loadDevices() {
        try {
            console.log('Loading devices...');
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            // Limpiar selects
            const cameraSelect = document.getElementById('cameraSelect');
            const microphoneSelect = document.getElementById('microphoneSelect');
            
            if (!cameraSelect || !microphoneSelect) {
                console.error('Device selects not found');
                return;
            }
            
            cameraSelect.innerHTML = '<option value="">Seleccionar cámara...</option>';
            microphoneSelect.innerHTML = '<option value="">Seleccionar micrófono...</option>';
            
            let cameraCount = 0;
            let microphoneCount = 0;
            
            // Filtrar y agregar TODOS los dispositivos
            devices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `${device.kind} ${index + 1}`;
                
                if (device.kind === 'videoinput') {
                    cameraSelect.appendChild(option);
                    cameraCount++;
                    console.log('Camera found:', device.label || `Camera ${cameraCount}`);
                } else if (device.kind === 'audioinput') {
                    microphoneSelect.appendChild(option);
                    microphoneCount++;
                    console.log('Microphone found:', device.label || `Microphone ${microphoneCount}`);
                }
            });
            
            // Actualizar contadores
            const cameraCountEl = document.getElementById('cameraCount');
            const microphoneCountEl = document.getElementById('microphoneCount');
            
            if (cameraCountEl) cameraCountEl.textContent = cameraCount;
            if (microphoneCountEl) microphoneCountEl.textContent = microphoneCount;
            
            // Auto-seleccionar primer dispositivo
            if (cameraSelect.options.length > 1) {
                cameraSelect.selectedIndex = 1;
                await this.switchCamera(cameraSelect.value);
            }
            if (microphoneSelect.options.length > 1) {
                microphoneSelect.selectedIndex = 1;
                await this.switchMicrophone(microphoneSelect.value);
            }
            
            console.log('Devices loaded:', { cameras: cameraCount, microphones: microphoneCount });
            
        } catch (error) {
            console.error('Device loading error:', error);
            this.showError('Error al cargar dispositivos: ' + error.message);
        }
    }

    async switchCamera(deviceId) {
        try {
            console.log('Switching camera to:', deviceId);
            
            if (this.currentStream) {
                this.currentStream.getTracks().forEach(track => track.stop());
            }
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: deviceId } },
                audio: false
            });
            
            const video = document.getElementById('videoPreview');
            if (video) {
                video.srcObject = stream;
                this.currentStream = stream;
                
                // Mostrar video y ocultar placeholder
                this.showVideoPreview();
                
                // Mostrar controles de cámara
                const cameraControls = document.getElementById('cameraControls');
                if (cameraControls) {
                    cameraControls.style.display = 'block';
                }
                
                this.showSuccess('Cámara cambiada correctamente');
            }
            
        } catch (error) {
            console.error('Error switching camera:', error);
            this.showError('Error al cambiar cámara: ' + error.message);
        }
    }

    async switchMicrophone(deviceId) {
        try {
            console.log('Switching microphone to:', deviceId);
            
            // Mantener video stream si existe
            const videoConstraints = this.currentStream && this.currentStream.getVideoTracks().length > 0 
                ? { deviceId: this.currentStream.getVideoTracks()[0].getSettings().deviceId || true }
                : false;
            
            // Parar solo los tracks de audio
            if (this.currentStream) {
                this.currentStream.getAudioTracks().forEach(track => track.stop());
            }
            
            const constraints = {
                video: videoConstraints,
                audio: {
                    deviceId: { exact: deviceId },
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Combinar tracks si hay video existente
            if (this.currentStream && this.currentStream.getVideoTracks().length > 0) {
                const videoTrack = this.currentStream.getVideoTracks()[0];
                const audioTrack = stream.getAudioTracks()[0];
                
                this.currentStream = new MediaStream([videoTrack, audioTrack]);
            } else {
                this.currentStream = stream;
            }
            
            this.setupAudioAnalyzer();
            this.showSuccess('Micrófono cambiado correctamente');
            
        } catch (error) {
            console.error('Error switching microphone:', error);
            this.showError('Error al cambiar micrófono: ' + error.message);
        }
    }

    showVideoPreview() {
        const video = document.getElementById('videoPreview');
        const placeholder = document.getElementById('videoPlaceholder');
        
        if (video && placeholder) {
            video.classList.remove('d-none');
            placeholder.classList.add('d-none');
        }
    }

    hideVideoPreview() {
        const video = document.getElementById('videoPreview');
        const placeholder = document.getElementById('videoPlaceholder');
        
        if (video && placeholder) {
            video.classList.add('d-none');
            placeholder.classList.remove('d-none');
        }
    }

    applyEffect(effect) {
        const video = document.getElementById('videoPreview');
        if (!video) return;
        
        // Remover efectos previos
        video.style.filter = '';
        
        // Aplicar nuevo efecto
        switch(effect) {
            case 'sepia':
                video.style.filter = 'sepia(100%)';
                break;
            case 'blur':
                video.style.filter = 'blur(3px)';
                break;
            case 'brightness':
                video.style.filter = 'brightness(150%)';
                break;
            case 'contrast':
                video.style.filter = 'contrast(150%)';
                break;
            case 'grayscale':
                video.style.filter = 'grayscale(100%)';
                break;
            case 'saturate':
                video.style.filter = 'saturate(200%)';
                break;
            case 'none':
            default:
                video.style.filter = 'none';
                break;
        }
        
        console.log('Applied effect:', effect);
    }

    updateActiveEffect(activeButton) {
        // Remove active class from all buttons
        document.querySelectorAll('.effect-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Add active class to clicked button
        if (activeButton) {
            activeButton.classList.add('active');
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
            console.error('Recording start error:', error);
            this.showError('Error al iniciar grabación: ' + error.message);
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
        
        if (!button || !buttonText || !indicator) return;
        
        if (isRecording) {
            button.className = 'btn btn-outline-danger';
            buttonText.textContent = 'Detener Grabación';
            indicator.classList.remove('d-none');
            const icon = button.querySelector('i');
            if (icon) icon.className = 'bi bi-stop-fill';
        } else {
            button.className = 'btn btn-danger';
            buttonText.textContent = 'Iniciar Grabación';
            indicator.classList.add('d-none');
            const icon = button.querySelector('i');
            if (icon) icon.className = 'bi bi-record-fill';
        }
    }

    startRecordingTimer() {
        const timeDisplay = document.getElementById('recordingTime');
        if (!timeDisplay) return;
        
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
        if (timeDisplay) {
            timeDisplay.classList.add('d-none');
            timeDisplay.textContent = '00:00';
        }
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
        
        if (audio) {
            audio.src = url;
            audio.classList.remove('d-none');
        }
        
        if (downloadBtn) {
            downloadBtn.classList.remove('d-none');
        }
        
        if (noRecording) {
            noRecording.classList.add('d-none');
        }
        
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
        
        if (alert && messageEl) {
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
        
        console.error('Error:', message);
    }

    showSuccess(message) {
        console.log('Success:', message);
        
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
        const alertElement = tempDiv.firstElementChild;
        document.body.appendChild(alertElement);
        
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
    console.log('DOM loaded, initializing DeviceTester...');
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