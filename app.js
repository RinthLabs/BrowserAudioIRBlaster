/**
 * Main Vue.js Application
 * Browser Audio IR Blaster
 */

const { createApp } = Vue;

createApp({
    data() {
        return {
            selectedBrand: 'lg',
            customCode: '0x20DF10EF',
            frequency: 38,
            lastCommand: '',
            audioUrl: null,
            audioBlob: null,
            irGenerator: null,
            audioContext: null,
            debugInfo: null,
            brands: TV_REMOTES,
            waveformZoom: 1,
            waveformOffset: 0,
            currentSignal: null,
            currentAddress: 0,
            currentCommand: 0
        };
    },

    mounted() {
        // Initialize IR generator
        this.irGenerator = new IRGenerator(this.frequency);
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Initialize Materialize components
        M.AutoInit();

        console.log('Browser Audio IR Blaster initialized');
        console.log('Sample rate:', this.irGenerator.sampleRate);
        console.log('Carrier frequency:', this.irGenerator.carrierFrequency / 1000, 'kHz');
    },

    watch: {
        frequency(newFreq) {
            // Update IR generator when frequency changes
            this.irGenerator = new IRGenerator(newFreq);
            console.log('Carrier frequency updated to:', newFreq, 'kHz');
        }
    },

    methods: {
        /**
         * Send a predefined IR command
         */
        sendCommand(commandName) {
            try {
                const brandCodes = this.brands[this.selectedBrand].codes;
                const hexCode = brandCodes[commandName];
                if (!hexCode) {
                    M.toast({ html: 'Command not found!', classes: 'red' });
                    return;
                }

                const brandName = this.brands[this.selectedBrand].name;
                this.lastCommand = commandName.toUpperCase();
                const hexString = '0x' + hexCode.toString(16).toUpperCase();

                console.log(`Sending ${brandName} command: ${commandName} (${hexString})`);

                this.generateAndPlay(hexCode, `${brandName} ${commandName.toUpperCase()}`);

                M.toast({
                    html: `<i class="material-icons left">check</i>Sent: ${commandName}`,
                    classes: 'green'
                });

            } catch (error) {
                console.error('Error sending command:', error);
                M.toast({ html: 'Error: ' + error.message, classes: 'red' });
            }
        },

        /**
         * Send a custom IR command
         */
        sendCustomCommand() {
            try {
                if (!this.customCode) {
                    M.toast({ html: 'Please enter a command code!', classes: 'orange' });
                    return;
                }

                this.lastCommand = this.customCode;
                console.log(`Sending custom command: ${this.customCode}`);

                // Parse hex code
                let code = this.customCode.replace(/0x/i, '');
                if (code.length !== 8) {
                    throw new Error('Invalid hex code format. Expected 8 hex digits (e.g., 0x20DF10EF)');
                }

                const fullCode = parseInt(code, 16);
                this.generateAndPlay(fullCode, 'Custom: ' + this.customCode);

                M.toast({
                    html: '<i class="material-icons left">check</i>Custom command sent!',
                    classes: 'green'
                });

            } catch (error) {
                console.error('Error sending custom command:', error);
                M.toast({ html: 'Error: ' + error.message, classes: 'red' });
            }
        },

        /**
         * Generate and play IR audio signal
         */
        generateAndPlay(hexCode, commandName = 'Custom') {
            // Extract address and command from hex code
            const address = (hexCode >> 24) & 0xFF;
            const command = (hexCode >> 8) & 0xFF;

            console.log(`Address: 0x${address.toString(16).toUpperCase()}, Command: 0x${command.toString(16).toUpperCase()}`);

            // Generate IR signal
            const signal = this.irGenerator.generateNECCommand(address, command);
            const audioBuffer = this.irGenerator.createAudioBuffer(signal);
            this.audioBlob = this.irGenerator.audioBufferToWav(audioBuffer);

            // Calculate duration in milliseconds
            const duration = (signal.length / this.irGenerator.sampleRate * 1000).toFixed(2);

            // Generate binary strings
            const addressInv = (~address) & 0xFF;
            const commandInv = (~command) & 0xFF;

            // Update debug information
            this.debugInfo = {
                commandName: commandName,
                hexCode: '0x' + hexCode.toString(16).toUpperCase().padStart(8, '0'),
                address: address,
                addressHex: '0x' + address.toString(16).toUpperCase().padStart(2, '0'),
                command: command,
                commandHex: '0x' + command.toString(16).toUpperCase().padStart(2, '0'),
                protocol: 'NEC Protocol',
                carrierFreq: this.frequency,
                sampleRate: this.irGenerator.sampleRate.toLocaleString(),
                duration: duration,
                binaryAddress: address.toString(2).padStart(8, '0'),
                binaryAddressInv: addressInv.toString(2).padStart(8, '0'),
                binaryCommand: command.toString(2).padStart(8, '0'),
                binaryCommandInv: commandInv.toString(2).padStart(8, '0')
            };

            // Create audio URL
            if (this.audioUrl) {
                URL.revokeObjectURL(this.audioUrl);
            }
            this.audioUrl = URL.createObjectURL(this.audioBlob);

            // Set audio source and play
            const audioPlayer = this.$refs.audioPlayer;
            audioPlayer.src = this.audioUrl;

            // Auto-play the audio
            audioPlayer.play().catch(error => {
                console.warn('Auto-play prevented:', error);
                M.toast({
                    html: 'Audio ready. Click play to transmit IR signal.',
                    classes: 'blue'
                });
            });

            // Store signal data for visualization
            this.currentSignal = signal;
            this.currentAddress = address;
            this.currentCommand = command;
            this.waveformZoom = 1;
            this.waveformOffset = 0;

            // Draw signal waveform visualization
            this.$nextTick(() => {
                this.drawWaveform();
            });
        },

        /**
         * Draw IR signal waveform on canvas with color coding and zoom
         */
        drawWaveform() {
            const canvas = this.$refs.waveformCanvas;
            if (!canvas || !this.currentSignal) return;

            const ctx = canvas.getContext('2d');
            const width = canvas.offsetWidth;
            const height = 200;
            const margin = { left: 50, right: 20, top: 20, bottom: 30 };
            const plotWidth = width - margin.left - margin.right;
            const plotHeight = height - margin.top - margin.bottom;

            // Set canvas resolution
            canvas.width = width;
            canvas.height = height;

            // Clear canvas
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);

            const signal = this.currentSignal;
            const samplesPerMs = this.irGenerator.sampleRate / 1000;

            // Calculate visible window with zoom and offset
            const baseWindow = 70; // Show 70ms by default
            const windowMs = baseWindow / this.waveformZoom;
            const totalMs = (signal.length / samplesPerMs);
            const startMs = this.waveformOffset;
            const endMs = Math.min(startMs + windowMs, totalMs);

            const startSample = Math.floor(startMs * samplesPerMs);
            const endSample = Math.floor(endMs * samplesPerMs);
            const samplesToShow = endSample - startSample;

            // Calculate timing for NEC protocol sections
            const timings = this.calculateNECTimings();

            // Draw Y-axis voltage labels and grid
            ctx.strokeStyle = '#e0e0e0';
            ctx.fillStyle = '#666';
            ctx.font = '10px Arial';
            ctx.lineWidth = 1;

            const voltageRange = 1.6; // Typical headphone output voltage
            const voltages = [voltageRange, voltageRange/2, 0, -voltageRange/2, -voltageRange];

            voltages.forEach((voltage, i) => {
                const y = margin.top + (plotHeight / 4) * i;

                // Grid line
                ctx.strokeStyle = i === 2 ? '#999' : '#e0e0e0';
                if (i === 2) ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(margin.left, y);
                ctx.lineTo(width - margin.right, y);
                ctx.stroke();
                ctx.setLineDash([]);

                // Voltage label
                ctx.fillStyle = '#666';
                ctx.textAlign = 'right';
                ctx.fillText(voltage.toFixed(1) + 'V', margin.left - 5, y + 4);
            });

            // Draw X-axis time labels
            const numTimeLabels = 5;
            for (let i = 0; i <= numTimeLabels; i++) {
                const x = margin.left + (plotWidth / numTimeLabels) * i;
                const timeMs = startMs + (windowMs / numTimeLabels) * i;

                ctx.strokeStyle = '#e0e0e0';
                ctx.beginPath();
                ctx.moveTo(x, margin.top);
                ctx.lineTo(x, height - margin.bottom);
                ctx.stroke();

                ctx.fillStyle = '#666';
                ctx.textAlign = 'center';
                ctx.fillText(timeMs.toFixed(1) + 'ms', x, height - 10);
            }

            // Draw color-coded waveform by section
            const samplesPerPixel = samplesToShow / plotWidth;

            for (let x = 0; x < plotWidth; x++) {
                const sampleIndex = startSample + Math.floor(x * samplesPerPixel);
                if (sampleIndex >= signal.length) break;

                const timeMs = (sampleIndex / samplesPerMs);
                const section = this.getSignalSection(timeMs, timings);

                // Set color based on section
                ctx.strokeStyle = section.color;
                ctx.lineWidth = 2;
                ctx.beginPath();

                // Get max value in this pixel's range
                let maxVal = 0;
                for (let i = 0; i < samplesPerPixel && sampleIndex + i < signal.length; i++) {
                    maxVal = Math.max(maxVal, Math.abs(signal[sampleIndex + i]));
                }

                const voltage = maxVal * voltageRange;
                const y = margin.top + plotHeight / 2 - (voltage / voltageRange) * (plotHeight / 2);

                const plotX = margin.left + x;
                ctx.moveTo(plotX, margin.top + plotHeight / 2);
                ctx.lineTo(plotX, y);
                ctx.stroke();
            }

            // Draw axis borders
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.strokeRect(margin.left, margin.top, plotWidth, plotHeight);

            // Draw section labels at top
            ctx.font = 'bold 11px Arial';
            this.drawSectionLabels(ctx, timings, startMs, endMs, margin, plotWidth);
        },

        /**
         * Calculate NEC protocol timing sections
         */
        calculateNECTimings() {
            const agcStart = 0;
            const agcEnd = 13.5; // 9ms pulse + 4.5ms space

            let currentTime = agcEnd;
            const bitTime = 2.25; // ~562.5µs pulse + space (avg)

            const sections = [
                { start: agcStart, end: agcEnd, type: 'AGC', color: '#666' }
            ];

            // Address bits (8 bits)
            const addressStart = currentTime;
            currentTime += bitTime * 8;
            sections.push({ start: addressStart, end: currentTime, type: 'Address', color: '#2196F3' });

            // ~Address bits (8 bits)
            const addressInvStart = currentTime;
            currentTime += bitTime * 8;
            sections.push({ start: addressInvStart, end: currentTime, type: '~Address', color: '#FF9800' });

            // Command bits (8 bits)
            const commandStart = currentTime;
            currentTime += bitTime * 8;
            sections.push({ start: commandStart, end: currentTime, type: 'Command', color: '#4CAF50' });

            // ~Command bits (8 bits)
            const commandInvStart = currentTime;
            currentTime += bitTime * 8;
            sections.push({ start: commandInvStart, end: currentTime, type: '~Command', color: '#9C27B0' });

            // Stop bit
            currentTime += 0.5625;
            sections.push({ start: commandInvStart + bitTime * 8, end: currentTime, type: 'Stop', color: '#666' });

            return sections;
        },

        /**
         * Get which section of the signal we're in at a given time
         */
        getSignalSection(timeMs, timings) {
            for (const section of timings) {
                if (timeMs >= section.start && timeMs < section.end) {
                    return section;
                }
            }
            return { type: 'Unknown', color: '#999' };
        },

        /**
         * Draw section labels
         */
        drawSectionLabels(ctx, timings, startMs, endMs, margin, plotWidth) {
            timings.forEach(section => {
                if (section.end < startMs || section.start > endMs) return;

                const visibleStart = Math.max(section.start, startMs);
                const visibleEnd = Math.min(section.end, endMs);
                const windowMs = endMs - startMs;

                const x1 = margin.left + ((visibleStart - startMs) / windowMs) * plotWidth;
                const x2 = margin.left + ((visibleEnd - startMs) / windowMs) * plotWidth;
                const labelX = (x1 + x2) / 2;

                if (x2 - x1 > 30) { // Only draw label if there's enough space
                    ctx.fillStyle = section.color;
                    ctx.textAlign = 'center';
                    ctx.fillText(section.type, labelX, 15);
                }
            });
        },

        /**
         * Zoom in on waveform
         */
        zoomIn() {
            this.waveformZoom = Math.min(this.waveformZoom * 2, 32);
            this.drawWaveform();
        },

        /**
         * Zoom out on waveform
         */
        zoomOut() {
            this.waveformZoom = Math.max(this.waveformZoom / 2, 1);
            this.drawWaveform();
        },

        /**
         * Pan left on waveform
         */
        panLeft() {
            const baseWindow = 70;
            const windowMs = baseWindow / this.waveformZoom;
            this.waveformOffset = Math.max(0, this.waveformOffset - windowMs * 0.25);
            this.drawWaveform();
        },

        /**
         * Pan right on waveform
         */
        panRight() {
            const baseWindow = 70;
            const windowMs = baseWindow / this.waveformZoom;
            const totalMs = (this.currentSignal.length / (this.irGenerator.sampleRate / 1000));
            this.waveformOffset = Math.min(totalMs - windowMs, this.waveformOffset + windowMs * 0.25);
            this.drawWaveform();
        },

        /**
         * Reset waveform view
         */
        resetZoom() {
            this.waveformZoom = 1;
            this.waveformOffset = 0;
            this.drawWaveform();
        },

        /**
         * Download the generated audio file
         */
        downloadAudio() {
            if (!this.audioBlob) {
                M.toast({ html: 'No audio to download. Generate a command first!', classes: 'orange' });
                return;
            }

            const url = URL.createObjectURL(this.audioBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ir_command_${this.lastCommand}_${Date.now()}.wav`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            M.toast({
                html: '<i class="material-icons left">download</i>Audio file downloaded!',
                classes: 'green'
            });
        }
    },

    beforeUnmount() {
        // Clean up
        if (this.audioUrl) {
            URL.revokeObjectURL(this.audioUrl);
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}).mount('#app');
