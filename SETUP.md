# Setup Instructions

Follow these steps to get your Browser Audio IR Blaster up and running on GitHub Pages.

## 1. Update Repository Links

Before deploying, update the following placeholders in the code:

### In `index.html` (line ~291):
Replace `yourusername` with your actual GitHub username:
```html
<a href="https://github.com/YOURUSERNAME/BrowserAudioIRBlaster" target="_blank" class="github-link">
```

### In `README.md`:
Replace all instances of `yourusername` with your actual GitHub username.

## 2. Update Donation Links (Optional)

### PayPal Donate Button
In `index.html` (line ~280), update the PayPal link:
```html
<a href="https://www.paypal.com/donate/?hosted_button_id=YOUR_BUTTON_ID" target="_blank" class="btn waves-effect waves-light donate-btn blue">
```

To get your PayPal donation button:
1. Go to https://www.paypal.com/donate/buttons
2. Create a donation button
3. Copy the hosted button ID
4. Replace `YOUR_BUTTON_ID` in the link

### GitHub Sponsors
In `index.html` (line ~285), update the GitHub Sponsors link:
```html
<a href="https://github.com/sponsors/YOURUSERNAME" target="_blank" class="btn waves-effect waves-light donate-btn pink">
```

## 3. Push to GitHub

```bash
git add .
git commit -m "Initial commit - Browser Audio IR Blaster"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/BrowserAudioIRBlaster.git
git push -u origin main
```

## 4. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on **Settings**
3. Navigate to **Pages** in the left sidebar
4. Under **Build and deployment**:
   - Source: Select **GitHub Actions**
5. The GitHub Actions workflow will automatically deploy your site

## 5. Access Your Site

After the workflow completes (check the **Actions** tab), your site will be available at:

```
https://YOURUSERNAME.github.io/BrowserAudioIRBlaster
```

## 6. Test the Application

1. Open the deployed site in your browser
2. Click any button to generate an IR signal
3. The audio player should load with the generated signal
4. Click play to transmit the IR signal through your audio output
5. Try the download button to save the audio file

## 7. Hardware Setup (Optional)

To actually control a TV, you'll need to build a simple IR transmitter circuit:

### Components Needed:
- IR LED (940nm wavelength)
- 100Ω resistor
- 10µF capacitor
- 3.5mm audio jack (male)
- Small breadboard or PCB

### Circuit:
```
Audio Jack Tip → [10µF Capacitor +] → [100Ω Resistor] → IR LED Anode (+)
Audio Jack Sleeve (Ground) → IR LED Cathode (-)
```

### Testing:
1. Connect the circuit to your device's headphone jack
2. Point the IR LED at your TV
3. Play an IR command from the web app
4. The TV should respond to the command

**Note**: You won't see the IR light with your eyes, but a smartphone camera can detect it (it will appear as a purple/white flicker).

## Troubleshooting

### GitHub Actions Workflow Fails
- Make sure you've enabled GitHub Actions in your repository settings
- Check that you've selected "GitHub Actions" as the Pages source

### Audio Doesn't Auto-Play
- Some browsers block auto-play. Just click the play button manually.
- Check your browser's console for any errors.

### IR Commands Don't Work
- Verify your circuit connections
- Make sure the IR LED polarity is correct (long leg = anode/+)
- Try adjusting the carrier frequency (some devices use 36 kHz or 40 kHz)
- Check that you're using the correct IR codes for your device

### Wrong Device Codes
- Search online for "[Your Device Brand] IR codes NEC protocol"
- Use an IR code database like LIRC or IrScrutinizer
- Use the custom command feature to test different codes

## Adding More Devices

To add support for additional devices:

1. Find the IR codes for your device (must be NEC protocol)
2. Edit `ir-generator.js`
3. Add a new object with the codes (similar to `LG_TV_CODES`)
4. Update `index.html` to add new buttons
5. Update the `sendCommand` method in `app.js` to handle new commands

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Verify all links and IDs are updated correctly
3. Make sure your browser supports Web Audio API
4. Try a different browser (Chrome/Edge recommended)

For additional help, please open an issue on GitHub.
