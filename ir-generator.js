/**
 * IR Signal Generator - NEC Protocol Implementation
 * Generates audio signals that can be used as IR commands
 */

class IRGenerator {
    constructor(carrierFrequency = 38) {
        this.carrierFrequency = carrierFrequency * 1000; // Convert kHz to Hz
        this.sampleRate = 192000; // High sample rate for better quality
        this.dutyCycle = 0.33; // 33% duty cycle for IR carrier
    }

    /**
     * Generate a modulated pulse
     * @param {number} duration - Duration in microseconds
     * @param {boolean} modulated - Whether to modulate with carrier frequency
     * @returns {Float32Array} - Audio samples
     */
    generatePulse(duration, modulated = true) {
        const samples = Math.floor((duration / 1000000) * this.sampleRate);
        const pulse = new Float32Array(samples);

        if (modulated) {
            const carrierPeriod = this.sampleRate / this.carrierFrequency;
            const onSamples = Math.floor(carrierPeriod * this.dutyCycle);

            for (let i = 0; i < samples; i++) {
                const carrierPosition = i % carrierPeriod;
                pulse[i] = carrierPosition < onSamples ? 0.8 : 0;
            }
        } else {
            // Space (silence)
            pulse.fill(0);
        }

        return pulse;
    }

    /**
     * Generate NEC protocol command
     * @param {number} address - 8-bit address
     * @param {number} command - 8-bit command
     * @returns {Float32Array} - Complete IR signal
     */
    generateNECCommand(address, command) {
        const segments = [];

        // AGC burst: 9ms pulse + 4.5ms space
        segments.push(this.generatePulse(9000, true));
        segments.push(this.generatePulse(4500, false));

        // Data bits (32 bits total)
        // Address + ~Address + Command + ~Command
        const data = [
            address,
            (~address) & 0xFF,
            command,
            (~command) & 0xFF
        ];

        for (const byte of data) {
            for (let bit = 0; bit < 8; bit++) {
                const bitValue = (byte >> bit) & 1;

                // All bits start with 562.5µs pulse
                segments.push(this.generatePulse(562.5, true));

                // Logical '1': 1687.5µs space
                // Logical '0': 562.5µs space
                const spaceTime = bitValue ? 1687.5 : 562.5;
                segments.push(this.generatePulse(spaceTime, false));
            }
        }

        // Final burst
        segments.push(this.generatePulse(562.5, true));

        // Add some silence at the end
        segments.push(this.generatePulse(50000, false));

        // Combine all segments
        const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0);
        const signal = new Float32Array(totalLength);

        let offset = 0;
        for (const segment of segments) {
            signal.set(segment, offset);
            offset += segment.length;
        }

        return signal;
    }

    /**
     * Generate audio buffer from IR signal
     * @param {Float32Array} signal - IR signal samples
     * @returns {AudioBuffer} - Web Audio API buffer
     */
    createAudioBuffer(signal) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = audioContext.createBuffer(1, signal.length, this.sampleRate);
        buffer.getChannelData(0).set(signal);
        return buffer;
    }

    /**
     * Convert audio buffer to WAV file blob
     * @param {AudioBuffer} buffer - Audio buffer
     * @returns {Blob} - WAV file blob
     */
    audioBufferToWav(buffer) {
        const length = buffer.length * buffer.numberOfChannels * 2;
        const arrayBuffer = new ArrayBuffer(44 + length);
        const view = new DataView(arrayBuffer);

        // WAV file header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        const floatTo16BitPCM = (output, offset, input) => {
            for (let i = 0; i < input.length; i++, offset += 2) {
                const s = Math.max(-1, Math.min(1, input[i]));
                output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // Format chunk size
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, buffer.numberOfChannels, true);
        view.setUint32(24, buffer.sampleRate, true);
        view.setUint32(28, buffer.sampleRate * 2 * buffer.numberOfChannels, true);
        view.setUint16(32, buffer.numberOfChannels * 2, true);
        view.setUint16(34, 16, true); // Bits per sample
        writeString(36, 'data');
        view.setUint32(40, length, true);

        floatTo16BitPCM(view, 44, buffer.getChannelData(0));

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    }

    /**
     * Generate IR command from hex code
     * @param {string} hexCode - Hex code (e.g., "0x20DF10EF")
     * @returns {Object} - Audio buffer and blob
     */
    generateFromHex(hexCode) {
        // Parse hex code
        let code = hexCode.replace(/0x/i, '');
        if (code.length !== 8) {
            throw new Error('Invalid hex code format. Expected 8 hex digits (e.g., 20DF10EF)');
        }

        const fullCode = parseInt(code, 16);
        const address = (fullCode >> 24) & 0xFF;
        const command = (fullCode >> 8) & 0xFF;

        const signal = this.generateNECCommand(address, command);
        const audioBuffer = this.createAudioBuffer(signal);
        const wavBlob = this.audioBufferToWav(audioBuffer);

        return { audioBuffer, wavBlob };
    }
}

// LG TV NEC codes (Address: 0x20)
const LG_TV_CODES = {
    power: 0x20DF10EF,
    num0: 0x20DF08F7,
    num1: 0x20DF8877,
    num2: 0x20DF48B7,
    num3: 0x20DFC837,
    num4: 0x20DF28D7,
    num5: 0x20DFA857,
    num6: 0x20DF6897,
    num7: 0x20DFE817,
    num8: 0x20DF18E7,
    num9: 0x20DF9867,
    volUp: 0x20DF40BF,
    volDown: 0x20DFC03F,
    chUp: 0x20DF00FF,
    chDown: 0x20DF807F,
    mute: 0x20DF906F,
    input: 0x20DFD02F,
    menu: 0x20DFC23D,
    back: 0x20DF14EB,
    home: 0x20DF3EC1,
    up: 0x20DF02FD,
    down: 0x20DF827D,
    left: 0x20DFE01F,
    right: 0x20DF609F,
    ok: 0x20DF22DD
};
