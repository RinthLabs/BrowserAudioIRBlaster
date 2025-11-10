/**
 * IR Signal Generator - NEC Protocol Implementation
 * Generates audio signals that can be used as IR commands
 */

class IRGenerator {
    constructor(carrierFrequency = 38) {
        this.carrierFrequency = carrierFrequency * 1000; // Convert kHz to Hz
        this.sampleRate = 192000; // High sample rate for better quality
        this.dutyCycle = 0.33; // 33% duty cycle for IR carrier
        this.timingCompensation = 1.035; // Compensate for iOS audio resampling (~3.5% slower)
    }

    /**
     * Generate a modulated pulse
     * @param {number} duration - Duration in microseconds
     * @param {boolean} modulated - Whether to modulate with carrier frequency
     * @returns {Float32Array} - Audio samples
     */
    generatePulse(duration, modulated = true) {
        // Apply timing compensation to account for iOS audio resampling
        const compensatedDuration = duration * this.timingCompensation;
        const samples = Math.floor((compensatedDuration / 1000000) * this.sampleRate);
        const pulseL = new Float32Array(samples);
        const pulseR = new Float32Array(samples);

        if (modulated) {
            // IR burst: 38kHz with 70% duty cycle - LED on longer than off
            const carrierPeriod = this.sampleRate / this.carrierFrequency;
            const onDuration = carrierPeriod * 0.7; // 70% duty cycle

            for (let i = 0; i < samples; i++) {
                const positionInPeriod = i % carrierPeriod;
                if (positionInPeriod < onDuration) {
                    // LED ON: L positive, R negative
                    pulseL[i] = 0.9;
                    pulseR[i] = -0.9;
                } else {
                    // LED OFF: L negative, R positive (brief reverse bias)
                    pulseL[i] = -0.9;
                    pulseR[i] = 0.9;
                }
            }
        } else {
            // Space: Balanced 50% duty cycle with low amplitude (averages to minimal LED activation)
            const carrierPeriod = this.sampleRate / this.carrierFrequency;

            for (let i = 0; i < samples; i++) {
                const positionInPeriod = i % carrierPeriod;
                if (positionInPeriod < carrierPeriod / 2) {
                    pulseL[i] = 0.05;
                    pulseR[i] = -0.05;
                } else {
                    pulseL[i] = -0.05;
                    pulseR[i] = 0.05;
                }
            }
        }

        return { left: pulseL, right: pulseR };
    }

    /**
     * Generate NEC protocol command
     * @param {number} address - 8-bit address
     * @param {number} command - 8-bit command
     * @param {number} repeatCount - Number of times to repeat the command (default 1)
     * @returns {Float32Array} - Complete IR signal
     */
    generateNECCommand(address, command, repeatCount = 1) {
        const allSegmentsL = [];
        const allSegmentsR = [];

        // Generate the command repeatCount times
        for (let repeat = 0; repeat < repeatCount; repeat++) {
            const segmentsL = [];
            const segmentsR = [];

            // AGC burst: 9ms pulse + 4.5ms space
            let pulse = this.generatePulse(9000, true);
            segmentsL.push(pulse.left);
            segmentsR.push(pulse.right);

            pulse = this.generatePulse(4500, false);
            segmentsL.push(pulse.left);
            segmentsR.push(pulse.right);

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
                    pulse = this.generatePulse(562.5, true);
                    segmentsL.push(pulse.left);
                    segmentsR.push(pulse.right);

                    // Logical '1': 1687.5µs space
                    // Logical '0': 562.5µs space
                    const spaceTime = bitValue ? 1687.5 : 562.5;
                    pulse = this.generatePulse(spaceTime, false);
                    segmentsL.push(pulse.left);
                    segmentsR.push(pulse.right);
                }
            }

            // Final stop burst
            pulse = this.generatePulse(562.5, true);
            segmentsL.push(pulse.left);
            segmentsR.push(pulse.right);

            // Add all segments from this command to the main array
            allSegmentsL.push(...segmentsL);
            allSegmentsR.push(...segmentsR);

            // Add gap between repeats (40ms), except after the last repeat
            if (repeat < repeatCount - 1) {
                const gapSamples = Math.floor((40000 / 1000000) * this.sampleRate);
                const gapL = new Float32Array(gapSamples);
                const gapR = new Float32Array(gapSamples);
                gapL.fill(0);
                gapR.fill(0);
                allSegmentsL.push(gapL);
                allSegmentsR.push(gapR);
            }
        }

        // Add final silence at the end (40ms)
        const silenceSamples = Math.floor((40000 / 1000000) * this.sampleRate);
        const silenceL = new Float32Array(silenceSamples);
        const silenceR = new Float32Array(silenceSamples);
        silenceL.fill(0);
        silenceR.fill(0);
        allSegmentsL.push(silenceL);
        allSegmentsR.push(silenceR);

        // Combine all segments
        const totalLength = allSegmentsL.reduce((sum, seg) => sum + seg.length, 0);
        const signalL = new Float32Array(totalLength);
        const signalR = new Float32Array(totalLength);

        let offset = 0;
        for (let i = 0; i < allSegmentsL.length; i++) {
            signalL.set(allSegmentsL[i], offset);
            signalR.set(allSegmentsR[i], offset);
            offset += allSegmentsL[i].length;
        }

        return { left: signalL, right: signalR };
    }

    /**
     * Generate audio buffer from IR signal
     * @param {Object} signal - IR signal samples with left and right channels
     * @returns {AudioBuffer} - Web Audio API buffer
     */
    createAudioBuffer(signal) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = audioContext.createBuffer(2, signal.left.length, this.sampleRate);
        buffer.getChannelData(0).set(signal.left);
        buffer.getChannelData(1).set(signal.right);
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

        // Interleave stereo channels
        if (buffer.numberOfChannels === 2) {
            const left = buffer.getChannelData(0);
            const right = buffer.getChannelData(1);
            let offset = 44;
            for (let i = 0; i < left.length; i++) {
                const sampleL = Math.max(-1, Math.min(1, left[i]));
                const sampleR = Math.max(-1, Math.min(1, right[i]));
                view.setInt16(offset, sampleL < 0 ? sampleL * 0x8000 : sampleL * 0x7FFF, true);
                offset += 2;
                view.setInt16(offset, sampleR < 0 ? sampleR * 0x8000 : sampleR * 0x7FFF, true);
                offset += 2;
            }
        } else {
            floatTo16BitPCM(view, 44, buffer.getChannelData(0));
        }

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
// Format: bits 0-7=Address, 8-15=~Address, 16-23=Command, 24-31=~Command (matches Arduino IRremote library)
const LG_TV_CODES = {
    power: 0xEF10DF20,
    num0: 0xF708DF20,
    num1: 0x7788DF20,
    num2: 0xB748DF20,
    num3: 0x37C8DF20,
    num4: 0xD728DF20,
    num5: 0x57A8DF20,
    num6: 0x9768DF20,
    num7: 0x17E8DF20,
    num8: 0xE718DF20,
    num9: 0x6798DF20,
    volUp: 0xBF40DF20,
    volDown: 0x3FC0DF20,
    chUp: 0xFF00DF20,
    chDown: 0x7F80DF20,
    mute: 0x6F90DF20,
    input: 0x2FD0DF20,
    menu: 0x3DC2DF20,
    back: 0xEB14DF20,
    home: 0xC13EDF20,
    up: 0xFD02DF20,
    down: 0x7D82DF20,
    left: 0x1FE0DF20,
    right: 0x9F60DF20,
    ok: 0xDD22DF20
};

// Samsung TV NEC codes (Address: 0x07)
// Format: bits 0-7=Address, 8-15=~Address, 16-23=Command, 24-31=~Command
const SAMSUNG_TV_CODES = {
    power: 0xFD02F807,
    num0: 0x778807,
    num1: 0xDF20F807,
    num2: 0x5FA0F807,
    num3: 0x9F60F807,
    num4: 0xEF10F807,
    num5: 0x6F90F807,
    num6: 0xAF50F807,
    num7: 0xCF30F807,
    num8: 0x4FB0F807,
    num9: 0x8F70F807,
    volUp: 0x1FE0F807,
    volDown: 0x2FD0F807,
    chUp: 0xB748F807,
    chDown: 0xF708F807,
    mute: 0x0FF0F807,
    input: 0x7F80F807,
    menu: 0xA758F807,
    back: 0xE51AF807,
    home: 0x9F60F807,
    up: 0xF906F807,
    down: 0x7986F807,
    left: 0x59A6F807,
    right: 0xB946F807,
    ok: 0xE916F807
};

// Sony TV NEC codes (Address: 0x01) - Note: Most Sony TVs use SIRC protocol, not NEC
// These are generic NEC codes that may work with some Sony models
const SONY_TV_CODES = {
    power: 0xFD02FE01,
    num0: 0xF708FE01,
    num1: 0xFF00FE01,
    num2: 0x7F80FE01,
    num3: 0xBF40FE01,
    num4: 0x3FC0FE01,
    num5: 0xDF20FE01,
    num6: 0x5FA0FE01,
    num7: 0x9F60FE01,
    num8: 0x1FE0FE01,
    num9: 0xEF10FE01,
    volUp: 0xBF40FE01,
    volDown: 0x3FC0FE01,
    chUp: 0xFF00FE01,
    chDown: 0x7F80FE01,
    mute: 0x6F90FE01,
    input: 0x2FD0FE01,
    menu: 0xCF30FE01,
    back: 0xEB14FE01,
    home: 0xC13EFE01,
    up: 0xFD02FE01,
    down: 0x7D82FE01,
    left: 0x1FE0FE01,
    right: 0x9F60FE01,
    ok: 0xDD22FE01
};

// Vizio TV NEC codes (Address: 0x04)
// Format: bits 0-7=Address, 8-15=~Address, 16-23=Command, 24-31=~Command
const VIZIO_TV_CODES = {
    power: 0xF708FB04,
    num0: 0x7D82FB04,
    num1: 0xFD02FB04,
    num2: 0xBD42FB04,
    num3: 0x3DC2FB04,
    num4: 0xDD22FB04,
    num5: 0x5DA2FB04,
    num6: 0x9D62FB04,
    num7: 0x1DE2FB04,
    num8: 0xED12FB04,
    num9: 0x6D92FB04,
    volUp: 0xBF40FB04,
    volDown: 0x3FC0FB04,
    chUp: 0xFF00FB04,
    chDown: 0x7F80FB04,
    mute: 0x6F90FB04,
    input: 0xD52AFB04,
    menu: 0x758AFB04,
    back: 0xA55AFB04,
    home: 0x956AFB04,
    up: 0xE51AFB04,
    down: 0x659AFB04,
    left: 0x25DAFB04,
    right: 0xC53AFB04,
    ok: 0x55AAFB04
};

// TCL/Roku TV NEC codes (Address: 0x08)
// Format: bits 0-7=Address, 8-15=~Address, 16-23=Command, 24-31=~Command
const TCL_TV_CODES = {
    power: 0xF708F708,
    num0: 0x3FC0F708,
    num1: 0xDF20F708,
    num2: 0x5FA0F708,
    num3: 0x9F60F708,
    num4: 0x1FE0F708,
    num5: 0xEF10F708,
    num6: 0x6F90F708,
    num7: 0xAF50F708,
    num8: 0x2FD0F708,
    num9: 0xCF30F708,
    volUp: 0xBF40F708,
    volDown: 0x37C8F708,
    chUp: 0xFF00F708,
    chDown: 0x7F80F708,
    mute: 0x4FB0F708,
    input: 0xD32CF708,
    menu: 0x33CCF708,
    back: 0x936CF708,
    home: 0x639CF708,
    up: 0x57A8F708,
    down: 0xD728F708,
    left: 0x9768F708,
    right: 0x17E8F708,
    ok: 0xB748F708
};

// All remote codes organized by brand
const TV_REMOTES = {
    lg: { name: 'LG', codes: LG_TV_CODES },
    samsung: { name: 'Samsung', codes: SAMSUNG_TV_CODES },
    sony: { name: 'Sony', codes: SONY_TV_CODES },
    vizio: { name: 'Vizio', codes: VIZIO_TV_CODES },
    tcl: { name: 'TCL/Roku', codes: TCL_TV_CODES }
};
