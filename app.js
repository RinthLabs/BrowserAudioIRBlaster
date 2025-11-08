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
            brands: TV_REMOTES
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
                duration: duration
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
