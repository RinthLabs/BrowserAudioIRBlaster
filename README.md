<p align="center">
  <img src="logo.png" alt="Browser Audio IR Blaster Logo" width="150">
</p>

# Browser Audio IR Blaster

A web-based infrared remote control that generates IR signals as audio output. Control your LG TV (and potentially other devices) using your browser's audio output connected to an IR LED circuit.

## Features

- **LG TV Remote Control**: Pre-programmed buttons for common LG TV functions
- **Custom Commands**: Send any IR command by entering hex codes
- **Adjustable Frequency**: Set carrier frequency (default 38 kHz for most TVs)
- **Audio Playback**: Play IR signals through your device's speaker/audio output
- **Download Audio**: Save IR command audio files for offline use
- **Material Design UI**: Clean, modern interface using Google Material Design
- **No Installation Required**: Runs entirely in the browser

## How It Works

The application generates infrared signals using the NEC protocol, which is commonly used by LG TVs and many other IR devices. The IR signals are encoded as audio waveforms that can be:

1. **Played through speakers**: Connect an IR LED circuit to your audio jack
2. **Downloaded as WAV files**: Save commands for later use
3. **Used with external IR transmitters**: Some devices accept audio input for IR transmission

### Hardware Setup (Optional)

To actually transmit IR signals, you need a simple circuit:

```
Audio Jack → [Capacitor] → [Resistor] → IR LED → Ground
                (10µF)        (100Ω)
```

**Note**: The polarity and component values may need adjustment based on your specific IR LED and audio output voltage.

## Usage

### Online

Visit the live demo: [https://rinthlabs.github.io/BrowserAudioIRBlaster](https://rinthlabs.github.io/BrowserAudioIRBlaster)

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/RinthLabs/BrowserAudioIRBlaster.git
   cd BrowserAudioIRBlaster
   ```

2. Open `index.html` in your web browser (no build step required!)

### Using Custom Commands

1. Find the IR code for your device (search online or use an IR code database)
2. Enter the 8-digit hex code in the format `0x20DF10EF`
3. Adjust the carrier frequency if needed (most TVs use 38 kHz)
4. Click "Send Custom Command"

## IR Code Format

The application uses NEC protocol format:
- **Address** (8 bits): Device address
- **~Address** (8 bits): Inverted address (for verification)
- **Command** (8 bits): Command code
- **~Command** (8 bits): Inverted command (for verification)

Example: `0x20DF10EF`
- Address: `0x20` (LG TV)
- Command: `0x10` (Power button)

## Supported Devices

Currently pre-configured for:
- **LG TVs** (NEC protocol, address 0x20)

You can add support for other devices by:
1. Finding the device's IR codes
2. Adding them to the `LG_TV_CODES` object in `ir-generator.js`
3. Or using the custom command feature

## Technical Details

- **Protocol**: NEC Infrared Protocol
- **Carrier Frequency**: 38 kHz (adjustable 30-60 kHz)
- **Sample Rate**: 192 kHz for high-quality audio generation
- **Duty Cycle**: 33%
- **Audio Format**: WAV (16-bit PCM)

## Browser Compatibility

Works in all modern browsers that support:
- Web Audio API
- HTML5 Audio Element
- Vue.js 3

Tested on:
- Chrome/Edge (Chromium)
- Firefox
- Safari

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for:
- Additional device codes
- New features
- Bug fixes
- Documentation improvements

## License

This project is open source and available under the MIT License.

## Support

If you find this project useful, please consider supporting:
- [PayPal Donate](https://www.paypal.com/donate/?hosted_button_id=7R4HTK3M4WMPS)
- [GitHub Sponsors](https://github.com/sponsors/BenRinthLabs)

## Disclaimer

This project is for educational and personal use. Ensure you have the right to control any devices you target with IR signals. The authors are not responsible for any misuse of this software.

## Credits

- Built with [Vue.js 3](https://vuejs.org/)
- Styled with [Materialize CSS](https://materializecss.com/)
- Icons from [Material Icons](https://material.io/icons/)

## References

- [NEC Protocol Documentation](https://www.sbprojects.net/knowledge/ir/nec.php)
- [IR Remote Control Theory](https://www.vishay.com/docs/80071/dataform.pdf)
