class DeviceTest {
    constructor() {
        this.videoStream = null;
        this.audioStream = null;
        this.combinedStream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.startTime = 0;
        this.timerInterval = null;
        this.recordedBlob = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.animationFrame = null;
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        await this.requestPermissions();
    }
    
    setupEventListeners() {
        // Camera controls
        document.getElementById('toggleCamera').addEventListener('click', () => this.toggleCamera());
        document.getElementById('cameraSelect').addEventListener('change', (e) => this.switchCamera(e.target.value));
        document.getElementById('micSelect').addEventListener('change', (e) => this.switchMicrophone(e.target.value));
        
        // Effect buttons
        document.querySelectorAll('.effect-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.applyEffect(e.target.dataset.effect);
                this.updateEffectButtons(e.target);
            });
        });
        
        // Recording controls
        document.getElementById('recordBtn').addEventListener('click', () => this.toggleRecording());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadAudio());
    }
    
    async requestPermissions() {
        try {
            this.showStatus('Solicitando permisos de cámara y micrófono...', 'warning');
            
            // Request permissions with specific constraints
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
            
            // Store the initial stream
            this.combinedStream = stream;
            
            this.showStatus('Permisos concedidos correctamente', 'success');
            
            // Load devices after getting permissions
            await this.loadDevices();
            
            // Setup initial streams
            await this.setupInitialStreams();
            
        } catch (error) {
            console.error('Error requesting permissions:', error);
            this.showStatus('Error: Se requieren permisos de cámara y micrófono para usar esta aplicación. Por favor, recarga la página y acepta los permisos.', 'danger');
        }
    }
    
    async setupInitialStreams() {
        try {
            // Separate video and audio streams
            const videoTracks = this.combinedStream.getVideoTracks();
            const audioTracks = this.combinedStream.getAudioTracks();
            
            if (videoTracks.length > 0) {
                this.videoStream = new MediaStream(videoTracks);
                // Auto-start camera
                this.showVideoPreview();
            }
            
            if (audioTracks.length > 0) {
                this.audioStream = new MediaStream(audioTracks);
                this.setupAudioAnalyzer();
            }
            
        } catch (error) {
            console.error('Error setting up initial streams:', error);
        }
    }
    
    async loadDevices() {
        try {
            // Enumerate devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            const cameraSelect = document.getElementById('cameraSelect');
            const micSelect = document.getElementById('micSelect');
            
            // Clear existing options
            cameraSelect.innerHTML = '<option value="">Seleccionar cámara...</option>';
            micSelect.innerHTML = '<option value="">Seleccionar micrófono...</option>';
            
            let cameraIndex = 1;
            let micIndex = 1;
            let selectedCamera = null;
            let selectedMic = null;
            
            devices.forEach(device => {
                if (device.kind === 'videoinput') {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.text = device.label || `Cámara ${cameraIndex++}`;
                    cameraSelect.appendChild(option);
                    
                    // Select the first camera by default
                    if (!selectedCamera) {
                        selectedCamera = device.deviceId;
                    }
                } else if (device.kind === 'audioinput') {
                    const option = document.createElement('option');
                    option.value = device.deviceId;
                    option.text = device.label || `Micrófono ${micIndex++}`;
                    micSelect.appendChild(option);
                    
                    // Select the first microphone by default
                    if (!selectedMic) {
                        selectedMic = device.deviceId;
                    }
                }
            });
            
            // Set selected values
            if (selectedCamera) {
                cameraSelect.value = selectedCamera;
            }
            if (selectedMic) {
                micSelect.value = selectedMic;
            }
            
            const cameraCount = cameraSelect.options.length - 1;
            const micCount = micSelect.options.length - 1;
            
            this.showStatus(`Dispositivos cargados: ${cameraCount} cámaras, ${micCount} micrófonos`, 'success');
            
        } catch (error) {
            console.error('Error loading devices:', error);
            this.showStatus('Error al cargar dispositivos', 'danger');
        }
    }
    
    showVideoPreview() {
        const video = document.getElementById('videoPreview');
        const placeholder = document.getElementById('videoPlaceholder');
        const btn = document.getElementById('toggleCamera');
        
        if (this.videoStream) {
            video.srcObject = this.videoStream;
            video.classList.remove('d-none');
            placeholder.classList.add('d-none');
            
            btn.innerHTML = '<i class="bi bi-camera-video-off me-1"></i> Desactivar';
            btn.className = 'btn btn-sm btn-secondary';
        }
    }
    
    hideVideoPreview() {
        const video = document.getElementById('videoPreview');
        const placeholder = document.getElementById('videoPlaceholder');
        const btn = document.getElementById('toggleCamera');
        
        video.srcObject = null;
        video.classList.add('d-none');
        placeholder.classList.remove('d-none');
        
        btn.innerHTML = '<i class="bi bi-camera-video me-1"></i> Activar';
        btn.className = 'btn btn-sm btn-primary';
    }
    
    async toggleCamera() {
        const video = document.getElementById('videoPreview');
        
        if (!video.classList.contains('d-none')) {
            // Hide camera
            this.hideVideoPreview();
        } else {
            // Show camera
            if (this.videoStream) {
                this.showVideoPreview();
            } else {
                // Try to get camera stream
                const cameraSelect = document.getElementById('cameraSelect');
                if (cameraSelect.value) {
                    await this.switchCamera(cameraSelect.value);
                } else {
                    this.showStatus('Por favor selecciona una cámara', 'warning');
                }
            }
        }
    }
    
    async switchCamera(deviceId) {
        if (!deviceId) return;
        
        try {
            // Stop existing video tracks
            if (this.videoStream) {
                this.videoStream.getTracks().forEach(track => track.stop());
            }
            
            // Get new video stream
            const constraints = {
                video: { 
                    deviceId: { exact: deviceId },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoStream = stream;
            
            // Show the video
            this.showVideoPreview();
            
        } catch (error) {
            console.error('Error switching camera:', error);
            this.showStatus('Error al cambiar cámara: ' + error.message, 'danger');
        }
    }
    
    async switchMicrophone(deviceId) {
        if (!deviceId) return;
        
        try {
            // Stop existing audio tracks
            if (this.audioStream) {
                this.audioStream.getTracks().forEach(track => track.stop());
            }
            
            // Clean up audio context
            if (this.audioContext) {
                await this.audioContext.close();
            }
            
            // Get new audio stream
            const constraints = {
                audio: { 
                    deviceId: { exact: deviceId },
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.audioStream = stream;
            
            // Setup audio analyzer
            this.setupAudioAnalyzer();
            
        } catch (error) {
            console.error('Error switching microphone:', error);
            this.showStatus('Error al cambiar micrófono: ' + error.message, 'danger');
        }
    }
    
    setupAudioAnalyzer() {
        if (!this.audioStream) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.microphone = this.audioContext.createMediaStreamSource(this.audioStream);
            
            this.analyser.fftSize = 256;
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            
            this.microphone.connect(this.analyser);
            this.updateAudioLevel();
            
        } catch (error) {
            console.error('Error setting up audio analyzer:', error);
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
        
        this.animationFrame = requestAnimationFrame(() => this.updateAudioLevel());
    }
    
    applyEffect(effect) {
        const video = document.getElementById('videoPreview');
        
        // Remove all effect classes first
        const classes = ['effect-sepia', 'effect-blur', 'effect-brightness', 'effect-contrast', 'effect-grayscale'];
        classes.forEach(cls => video.classList.remove(cls));
        
        // Apply new effect
        if (effect && effect !== 'none') {
            video.classList.add(`effect-${effect}`);
        }
    }
    
    updateEffectButtons(activeBtn) {
        document.querySelectorAll('.effect-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        activeBtn.classList.add('active');
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
            if (!this.audioStream) {
                this.showStatus('Por favor selecciona un micrófono primero', 'warning');
                return;
            }
            
            this.recordedChunks = [];
            
            // Determine best MIME type
            let mimeType = 'audio/webm;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'audio/webm';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = 'audio/mp4';
                    if (!MediaRecorder.isTypeSupported(mimeType)) {
                        mimeType = '';
                    }
                }
            }
            
            const options = mimeType ? { mimeType } : {};
            this.mediaRecorder = new MediaRecorder(this.audioStream, options);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };
            
            this.mediaRecorder.start(100); // Collect data every 100ms
            this.isRecording = true;
            this.startTime = Date.now();
            this.updateRecordButton(true);
            this.startTimer();
            
            this.showStatus('Grabación iniciada', 'success');
            
        } catch (error) {
            console.error('Error starting recording:', error);
            this.showStatus('Error al iniciar grabación: ' + error.message, 'danger');
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.updateRecordButton(false);
            this.stopTimer();
            this.showStatus('Grabación detenida', 'success');
        }
    }
    
    updateRecordButton(isRecording) {
        const btn = document.getElementById('recordBtn');
        if (isRecording) {
            btn.innerHTML = '<i class="bi bi-stop-circle me-1"></i> Detener';
            btn.className = 'btn btn-secondary btn-sm recording';
        } else {
            btn.innerHTML = '<i class="bi bi-record-circle me-1"></i> Grabar';
            btn.className = 'btn btn-danger btn-sm';
        }
    }
    
    startTimer() {
        const timeElement = document.getElementById('recordTime');
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.startTime;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            const displaySeconds = seconds % 60;
            
            timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        document.getElementById('recordTime').textContent = '00:00';
    }
    
    processRecording() {
        if (this.recordedChunks.length === 0) {
            this.showStatus('No se pudo grabar audio', 'warning');
            return;
        }
        
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        this.recordedBlob = new Blob(this.recordedChunks, { type: mimeType });
        
        const audioPlayer = document.getElementById('audioPlayer');
        const audioControls = document.getElementById('audioControls');
        
        const audioUrl = URL.createObjectURL(this.recordedBlob);
        audioPlayer.src = audioUrl;
        audioControls.classList.remove('d-none');
        
        this.showStatus('Grabación completada y lista para reproducir', 'success');
    }
    
    downloadAudio() {
        if (!this.recordedBlob) {
            this.showStatus('No hay grabación para descargar', 'warning');
            return;
        }
        
        const url = URL.createObjectURL(this.recordedBlob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        
        a.href = url;
        a.download = `grabacion_${timestamp}.webm`;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        this.showStatus('Descarga iniciada', 'success');
    }
    
    showStatus(message, type) {
        const statusMessage = document.getElementById('statusMessage');
        const statusText = document.getElementById('statusText');
        
        statusMessage.className = `alert alert-${type}`;
        statusText.textContent = message;
        statusMessage.classList.remove('d-none');
        
        // Auto-hide success and warning messages after 4 seconds
        if (type === 'success' || type === 'warning') {
            setTimeout(() => {
                statusMessage.classList.add('d-none');
            }, 4000);
        }
    }
    
    // Cleanup method
    cleanup() {
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
        }
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
        }
        if (this.combinedStream) {
            this.combinedStream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext) {
            this.audioContext.close().catch(console.error);
        }
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.deviceTest = new DeviceTest();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.deviceTest) {
        window.deviceTest.cleanup();
    }
});

// Handle visibility change to pause/resume audio analysis
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.deviceTest && window.deviceTest.animationFrame) {
        cancelAnimationFrame(window.deviceTest.animationFrame);
    } else if (!document.hidden && window.deviceTest && window.deviceTest.setupAudioAnalyzer) {
        window.deviceTest.updateAudioLevel();
    }
});