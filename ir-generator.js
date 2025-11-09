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
            const amplitude = 0.8;

            for (let i = 0; i < samples; i++) {
                // Generate 38kHz sine wave carrier (unipolar: 0V to +amplitude)
                // This is the standard for IR transmission via audio output
                const phase = (2 * Math.PI * i) / carrierPeriod;
                const sineWave = Math.sin(phase);

                // Convert from bipolar (-1 to +1) to unipolar (0 to amplitude)
                pulse[i] = ((sineWave + 1) / 2) * amplitude;
            }
        } else {
            // Space (silence) - stay at 0V
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

// Samsung TV NEC codes (Address: 0x07)
const SAMSUNG_TV_CODES = {
    power: 0x0707E0E040BF,
    num0: 0x0707E0E08877,
    num1: 0x0707E0E020DF,
    num2: 0x0707E0E0A05F,
    num3: 0x0707E0E0609F,
    num4: 0x0707E0E010EF,
    num5: 0x0707E0E0906F,
    num6: 0x0707E0E050AF,
    num7: 0x0707E0E030CF,
    num8: 0x0707E0E0B04F,
    num9: 0x0707E0E0708F,
    volUp: 0x0707E0E0E01F,
    volDown: 0x0707E0E0D02F,
    chUp: 0x0707E0E048B7,
    chDown: 0x0707E0E008F7,
    mute: 0x0707E0E0F00F,
    input: 0x0707E0E0807F,
    menu: 0x0707E0E058A7,
    back: 0x0707E0E01AE5,
    home: 0x0707E0E079867,
    up: 0x0707E0E006F9,
    down: 0x0707E0E08679,
    left: 0x0707E0E0A659,
    right: 0x0707E0E046B9,
    ok: 0x0707E0E016E9
};

// Sony TV NEC codes (Address: 0x01) - Some Sony models support NEC
const SONY_TV_CODES = {
    power: 0x0101A90B750A,
    num0: 0x0101A90B09F6,
    num1: 0x0101A90B00FF,
    num2: 0x0101A90B807F,
    num3: 0x0101A90B40BF,
    num4: 0x0101A90BC03F,
    num5: 0x0101A90B20DF,
    num6: 0x0101A90BA05F,
    num7: 0x0101A90B609F,
    num8: 0x0101A90BE01F,
    num9: 0x0101A90B10EF,
    volUp: 0x0101A90B490B,
    volDown: 0x0101A90BC906,
    chUp: 0x0101A90B090F,
    chDown: 0x0101A90B8906,
    mute: 0x0101A90B290D,
    input: 0x0101A90BA50A,
    menu: 0x0101A90B070F,
    back: 0x0101A90B62F9,
    home: 0x0101A90B070F,
    up: 0x0101A90B2BD4,
    down: 0x0101A90BABD4,
    left: 0x0101A90B2DD2,
    right: 0x0101A90BCDD2,
    ok: 0x0101A90BA50A
};

// Vizio TV NEC codes (Address: 0x04)
const VIZIO_TV_CODES = {
    power: 0x0404FB08F7,
    num0: 0x0404FB827D,
    num1: 0x0404FB02FD,
    num2: 0x0404FB42BD,
    num3: 0x0404FBC23D,
    num4: 0x0404FB22DD,
    num5: 0x0404FBA25D,
    num6: 0x0404FB629D,
    num7: 0x0404FBE21D,
    num8: 0x0404FB12ED,
    num9: 0x0404FB926D,
    volUp: 0x0404FB40BF,
    volDown: 0x0404FBC03F,
    chUp: 0x0404FB00FF,
    chDown: 0x0404FB807F,
    mute: 0x0404FB906F,
    input: 0x0404FB2AD5,
    menu: 0x0404FB8A75,
    back: 0x0404FB5AA5,
    home: 0x0404FB6A95,
    up: 0x0404FB1AE5,
    down: 0x0404FB9A65,
    left: 0x0404FBDA25,
    right: 0x0404FB3AC5,
    ok: 0x0404FBAA55
};

// TCL/Roku TV NEC codes (Address: 0x08)
const TCL_TV_CODES = {
    power: 0x0808F708F7,
    num0: 0x0808F7C03F,
    num1: 0x0808F720DF,
    num2: 0x0808F7A05F,
    num3: 0x0808F7609F,
    num4: 0x0808F7E01F,
    num5: 0x0808F710EF,
    num6: 0x0808F7906F,
    num7: 0x0808F750AF,
    num8: 0x0808F7D02F,
    num9: 0x0808F730CF,
    volUp: 0x0808F740BF,
    volDown: 0x0808F7C837,
    chUp: 0x0808F700FF,
    chDown: 0x0808F7807F,
    mute: 0x0808F7B04F,
    input: 0x0808F72CD3,
    menu: 0x0808F7CC33,
    back: 0x0808F76C93,
    home: 0x0808F79C63,
    up: 0x0808F7A857,
    down: 0x0808F728D7,
    left: 0x0808F76897,
    right: 0x0808F7E817,
    ok: 0x0808F748B7
};

// All remote codes organized by brand
const TV_REMOTES = {
    lg: { name: 'LG', codes: LG_TV_CODES },
    samsung: { name: 'Samsung', codes: SAMSUNG_TV_CODES },
    sony: { name: 'Sony', codes: SONY_TV_CODES },
    vizio: { name: 'Vizio', codes: VIZIO_TV_CODES },
    tcl: { name: 'TCL/Roku', codes: TCL_TV_CODES }
};
