# VIBECADE

A retro-themed virtual arcade environment built with Three.js, featuring interactive game cabinets and dynamic neon lighting.

## Layout and Orientation

The arcade is oriented with cardinal directions as follows:
- **North Wall**: Main entrance with a 12-unit wide central opening (from x = -3 to x = 9), opposite the VIBECADE sign. Contains the exit portal (centered at x = 0, z = 9.8) and start portal (at x = 4, z = 9.8) when arriving through a portal.
- **East Wall**: Split into two sections with a nook:
  - Lower section (10 units) from z = -10 to z = 0
  - Upper section (2 units) from z = 8 to z = 10
  - Nook dimensions: 2.5 units deep × 8 units wide, extending from z = 0 to z = 8
  - Prize counter in nook:
    - Yellow counter matching continuous line color and glow
    - 1.2 units wide × 0.8 units high × 5.5 units long
    - Positioned near front of nook (x = -15.4)
    - Extends from z = 2.5 to z = 8, leaving gap for access
    - Illuminated by soft purple point light
    - Large neon "PRIZES" text on west-facing side:
      - Yellow glowing text matching upper countertop color
      - 120px "Press Start 2P" font
      - 2.5 units wide × 0.5 units high text plane
      - Positioned at y = 0.4 units height
      - Centered at z = 4.25
      - Double-sided material with emissive glow
- **South Wall**: Contains the VIBECADE neon sign, therube.jpg, and advertising poster slot #1
- **West Wall**: Contains advertising poster slots #2 and #3, as well as therube2.jpg

Coordinate System Mapping:
- **East Wall**: x = -15 (main wall), x = -17.5 (nook back wall)
- **West Wall**: x = 15
- **South Wall**: z = -10
- **North Wall**: z = 10
- **Floor**: y = 0
- **Ceiling**: y = 4.5

The room dimensions are 32 units wide (x-axis) × 20 units deep (z-axis) × 4.5 units high (y-axis), with the nook extending 2.5 units east at x = -17.5.

## Poster Slots

The arcade features designated poster slots for advertising and decoration:
- **Poster Slot 1**: South wall - "YOUR AD HERE" poster with:
  - Purple to teal gradient background
  - Rotating light beam effects
  - Pulsing neon border
  - Purple point light for enhanced visibility
- **Poster Slot 2**: West wall - "ADVERTISE HERE" poster with:
  - Dynamic rainbow gradient background
  - Pulsing neon text effect
  - Arcade-style "INSERT COIN" and "FREE PLAY" text
  - Pink point light for enhanced visibility
- **Poster Slot 3**: West wall - "YOUR AD HERE" poster with:
  - Purple to teal gradient background
  - Rotating light beam effects
  - Pulsing neon border
  - Cyan point light for enhanced visibility
- **Poster Slot 4**: East wall - Additional advertising space

## FOR CLAUDE:
## ALWAYS UPDATE THE README AFTER MAKING CHANGES. KEEP THIS SHIT UP TO DATE.

## Features

### Arcade Environment
- 7 interactive game cabinets arranged in two rows:
  - Front row (cabinets 1-3): Fly Pieter, Garden Club, and Pizza Legends
  - Back row (cabinets 9-12): Vibe Synth, Pixel Paint, Retro Racer, and Pong
- Dynamic neon lighting with pulsing effects
- Background music system:
  - Intelligent domain detection for production vs development
  - Mobile-optimized audio playback
  - Touch event support for mobile devices
  - Automatic track progression with error recovery
  - Debug logging for troubleshooting
  - Volume set to 10% for ambient atmosphere
  - Playlist:
    - Neon Dreams
    - Fragmented Reverie
    - Fragments of Tomorrow
    - Neon Shadows 2
    - Neon Shadows
    - Neon Skyline
- Retro-style posters with gradient effects positioned at:
  - South wall - "YOUR AD HERE" poster with:
    - Purple to teal gradient background
    - Rotating light beam effects
    - Pulsing neon border
    - Purple point light for enhanced visibility
  - West wall - Level Up poster featuring therube2.jpg image (wider format)
  - West wall - Stripe Button poster with:
    - Dynamic rainbow gradient background
    - Pulsing neon text effect
    - Arcade-style "INSERT COIN" and "FREE PLAY" text
    - Pink point light for enhanced visibility
  - East wall - Additional advertising space
- Black ceiling with no text
- Custom floor texture with:
  - Dark black/purple background (#050008)
  - Small neon six-pointed stars (5px outer radius, 2.5px inner radius)
  - Random star colors: magenta, cyan, red, green, yellow
  - Proper aspect ratio mapping (6x4 repeats) to prevent stretching
  - 20 stars per texture tile
- White neon border lines running along all walls
- VIBECADE neon sign on the south wall with adaptive gap in border lines
- Debug log display at top of screen for real-time event monitoring
- Vibe Jam 2025 link in bottom-right corner:
  - Fixed position with game controller emoji
  - Clean white background with black text
  - System UI font for modern look
  - Opens in new tab when clicked
  - Styled with rounded top-left corner
  - High z-index to stay above other elements
- Vibeverse Portal System:
  - Exit portal centered in entrance gap (x = 0, z = 9.8) with green neon effect
  - Start portal appears 4 units right of exit portal (x = 4, z = 9.8) when arriving through portal
  - Portal effects include:
    - Glowing torus ring
    - Semi-transparent inner surface
    - Animated particle system
    - Floating text label for exit portal
  - Portal collision detection:
    - Fixed-size collision boxes (3x3x1 units)
    - Invisible collision boundaries for clean aesthetics
    - Precise player intersection detection
  - Seamless portal transitions:
    - Automatic URL parameter handling
    - Player state preservation between games
    - Background preloading of next destination
    - Return portal creation at spawn point
  - Portal parameters:
    - username: Player's display name
    - color: Player avatar color
    - speed: Movement speed (in m/s)
    - ref: Origin game URL for return portal

### Game Cabinets
- Each cabinet uses a detailed GLTF 3D model with:
  - High-quality arcade cabinet mesh
  - Interactive screen display
  - Game-specific textures
  - Number label on the floor (properly oriented)
  - Precise collision boxes for accurate interaction
- Cabinet features:
  - Custom screen textures for each game
  - Emissive screen display for visibility
  - Interactive hover effects and game launch capability
  - Accurate collision detection from all angles
- Cabinets are arranged in two parallel rows
- Each cabinet has a Box3-based collision system
- Special cabinets:
  - Pong (Cabinet 12): Simplified non-GLTF cabinet with:
    - Basic geometry-based cabinet structure (1.0 × 2.0 × 0.7 units)
    - Black emissive screen display with retro green text
    - Floor number label matching other cabinets
    - Full collision and interaction support
    - Two-player competitive gameplay:
      - First player to score 10 points wins
      - Classic paddle and ball mechanics
      - Score display for both players
      - Game states: Title ("CLICK TO START"), Waiting for P2, Playing, Game Over
      - Game over sequence:
        - Displays "PLAYER ONE/TWO WINS"
        - Flashes winner text for 5 seconds (0.7s on, 0.3s off)
        - Automatically returns to title screen
        - Resets all game variables for next match

### Lighting
- Ambient base lighting
- Directional overhead lighting
- Colored point lights for neon effects
- Cabinet-specific spotlights
- Dynamic light intensity variations

### Multiplayer
- Real-time multiplayer support with player synchronization
- Player collision detection to prevent clipping
- Visual player representations with:
  - Distinct colored avatars for each player
  - Smooth position and rotation interpolation
  - Proper collision handling between players
- Synchronized arcade cabinet interactions
- Support for both first-person and third-person perspectives in multiplayer
- Advanced safe spawning system:
  - Client-side candidate position generation
  - Server-side position validation
  - Minimum safe distance enforcement
  - Multi-attempt positioning with fallback options
  - Real-time position negotiation between client and server
- Chat System:
  - Press Enter to open chat input
  - Type message and press Enter again to send
  - Messages appear in chat bubbles above players' heads
  - Chat bubbles use sprite-based billboarding to always face the camera
  - Semi-transparent black background with white text
  - "Press Start 2P" retro font for authentic arcade feel
  - Messages visible to all players in real-time
  - Dynamic text features:
    - Automatic font size adjustment based on message length
    - Text wrapping for long messages
    - Bubble size adapts to content
    - Minimum font size of 8px for readability
  - Message timing:
    - Messages automatically fade after 5 seconds
    - Timer resets when new message is sent
    - Messages remain visible until timeout or new message
  - Proper handling of font loading with fallback to monospace
  - Chat labels always readable from any angle or distance

### Web Browser Screen
- Interactive 3D web browser display in the arcade
- Located near cabinets 9-11
- Shows real-time content from fly.pieter.com
- Features:
  - Interactive only when explicitly clicked to activate
  - Clear visual feedback showing activation state
  - Focus protection to prevent keyboard event hijacking
  - Click-to-toggle activation model for better user experience
  - Visual indicators showing active/inactive state
  - Automatic blur when deactivated to return focus to game controls
  - Seamlessly integrated with arcade environment

### Pong Game
- Classic single-player vs AI or two-player competitive gameplay
- Game States:
  - Title Screen: Displays "CLICK TO START"
  - Waiting: Shows "WAITING FOR PLAYER 2" with AI option
  - Playing: Active gameplay with score display
  - Game Over: Winner announcement with dramatic flashing
- Gameplay Features:
  - First player to score 10 points wins
  - Controls:
    - Desktop: Arrow keys (up/down) for paddle movement
    - Mobile: Virtual joystick with vertical movement for paddle control
    - Smooth, responsive paddle movement on both platforms
  - AI-controlled or player-controlled right paddle
  - Real-time multiplayer synchronization:
    - Ball position and movement synced across all clients
    - Paddle positions synced for both AI and multiplayer modes
    - Score updates broadcast to all spectators
    - Game state changes synchronized for all viewers
    - Automatic reconnection handling
  - Dynamic ball physics:
    - Angle-based paddle bounces
    - Speed variations based on hit position
    - Paddle movement influence on ball direction
    - Vertical speed clamping to prevent extreme angles
  - Score tracking and display:
    - Left and right player scores
    - Score flashing on points
    - Particle explosions at exact ball impact points
    - Orange particle effects for scoring impacts
  - AI opponent features:
    - Predictive ball tracking
    - 92% accuracy factor for beatable gameplay
    - Dynamic speed adjustment
    - Intelligent movement only when ball approaches
  - Visual Effects:
    - Score flashing on points
    - Explosion particles at exact ball collision points
    - Dramatic game over sequence
    - Retro green text on black background
- Game Over Sequence:
  - Winner announcement ("PLAYER ONE/TWO WINS")
  - Dramatic flashing effect (0.7s on, 0.3s off)
  - 5-second celebration period
  - Automatic return to title screen
  - Complete game state reset for next match
- Multiplayer Features:
  - Seamless spectator mode for additional players
  - Real-time game state synchronization
  - Consistent experience across all clients
  - Support for both AI and human opponents
  - Automatic host selection and state management
  - Graceful handling of player disconnections
  - Automatic game state recovery on reconnection
- Visual Design:
  - Classic retro aesthetic
  - Green-on-black color scheme
  - Pixel-perfect collision detection
  - Smooth paddle and ball movement
  - Responsive visual feedback
  - Particle effects for scoring events

### Player Character
- Minecraft-inspired blocky character design with:
  - Taller, skinnier proportions for better aesthetics
  - Helmet-style brown hair piece that covers the top, back and sides of the head (but not the face)
  - Visible neck connecting head to body
  - Flesh-colored cuboid head with facial features:
    - Black rectangular eyes
    - Simple rectangular mouth
  - Colored body to differentiate players
  - Jointed limbs for realistic movement
  - Visible hands at the end of arms
  - Shoes at the bottom of legs
- Enhanced walking animations:
  - Arms and legs swing in alternating patterns when moving (legs at 0.6 amplitude, arms at 0.45)
  - Subtle body bounce effect while walking (0.04 units)
  - Animation speed synced with movement speed (8x multiplier)
  - Smooth transitions between moving and standing poses
  - Precise ground placement with feet properly touching the floor
- Character visibility:
  - First-person mode: Character is hidden
  - Third-person mode: Full character model visible
- Proper collision handling with:
  - Cabinet collision detection
  - Player-to-player collision avoidance
  - Smooth movement correction when collisions occur

## Controls

### Desktop Controls
- W: Move forward
- S: Move backward
- A: Move left
- D: Move right
- SPACE: Jump
- V: Toggle between first-person and third-person views
  - First-person: Traditional FPS controls with locked mouse
  - Third-person: Camera follows behind character with direct mouse control

### Spawn System & Collision Handling
- Intelligent random spawn point system:
  - Players spawn at random locations in the central arcade area
  - Spawn algorithm ensures minimum safe distance (1.0 units) from other players
  - Multi-attempt system tries up to 20 different locations before falling back to a safe position
  - Server validates spawn positions to prevent player overlap
  - Boundary area for spawns: X (-8 to -2), Z (-9 to -7)
- Enhanced collision response:
  - Active collision detection between players prevents clipping
  - Adaptive push force based on proximity (stronger when players are very close)
  - Random offset addition when players are extremely close to prevent getting stuck
  - Multiple collision box layers (player, cabinet, environment)
  - Progressive collision response system that scales force with proximity

### Mobile Controls
- D-pad (bottom center of screen): Movement controls
  - Up: Move forward
  - Down: Move backward
  - Left: Move left
  - Right: Move right
- Touch and drag (right side of screen): Camera controls
  - Horizontal swipe: Look left/right
  - Vertical swipe: Look up/down
  - No roll rotation to prevent disorientation
  - Increased sensitivity for smoother control
- Semi-transparent gray D-pad with subtle borders
- D-pad positioned at bottom center for easy thumb access
- Automatic mobile detection and control switching
- Movement flags won't get overridden by keyboard polling on mobile
- D-pad buttons update both the visual log text and control 3D movement
- Proper event propagation handling to prevent conflicts with other touch events
- Debug logging displays which D-pad button was pressed/released with timestamps

### Camera and View Modes
- Initial spawn position: Random location in central area between cabinet rows
- Initial view direction: Looking down the left aisle (-90° rotation)
- First-person mode:
  - Mouse controls camera rotation
  - Movement relative to camera direction
  - Click to lock/unlock mouse pointer
- Third-person mode:
  - Camera positioned behind character
  - Character maintains same facing direction as first-person view
  - Mouse directly controls character rotation
  - Movement relative to character orientation
  - No pointer lock required

### Interaction
- Mouse: Look around (responsive in both first and third-person modes)
- Click: Lock/unlock mouse pointer (in first-person mode)
- Hover over cabinet: Display game information
- Click cabinet (when close): Launch game

## Technical Details

### Performance Optimizations
- Optional GLTF model loading:
  - Game cabinet 3D models can be disabled for better performance on mobile/iPad
  - Cabinet positions, numbers, and interaction logic remain functional
  - Collision detection and hover effects still work
  - All URLs and metadata preserved
  - Loading screen adapts to model-less mode
  - Implementation:
    - Models commented out in `src/main.js` and `src/cabinets.js`
    - Cabinet groups and floor numbers still rendered
    - Collision boxes maintained for accurate interaction
- Disabled Features:
  - Web browser screen commented out to prevent WebSocket connections
  - 3D test button commented out to reduce scene complexity
  - Both features' code preserved for future re-enablement

### Font Loading
- Uses Google Fonts' "Press Start 2P" for retro arcade aesthetic
- Font loading optimizations:
  - Preconnect to Google Fonts domains
  - Preload font stylesheet
  - Limited character set loading for faster initial paint
  - Font-display: swap for better performance
  - Fallback fonts: 'Courier New', monospace
- Font is used consistently across:
  - Loading screen
  - Game information displays
  - Control instructions
  - Cabinet information popups

### Camera System
- First-person mode: Uses PointerLockControls for precise FPS-style movement
- Third-person mode: Direct camera control with:
  - Instant response to mouse movement
  - No smoothing or delay effects
  - Clamped vertical rotation (-60° to 45°)
  - Fixed follow distance
- Mobile camera control:
  - Quaternion-based rotation to prevent roll
  - Continuous panning across multiple touch gestures
  - Delta-based movement calculation for smooth rotation
  - Maintains camera orientation between touch interactions
  - Separate handling for first-person and third-person modes
  - Split-screen touch zones (right half for camera, left half for D-pad)
  - Optimized touch sensitivity for mobile devices
  - YXZ Euler order to maintain stable orientation
  - Clamped pitch angles to prevent disorientation
  - Proper touch event filtering to prevent D-pad interference
  - Improved state management between gestures

### Debug Logging System
- Positioned at the top of the screen
- Semi-transparent black background with white text
- Hidden by default and only displays when there's actual log content
- Dynamically shows and hides based on message content
- Real-time logging of:
  - Mobile device detection status
  - D-pad button presses and releases
  - Touch position coordinates
  - Mobile control initialization 
- Implemented using a DOM element with fixed positioning
- Automatically updates to show most recent debug message
- Particularly useful for diagnosing mobile control issues
- Allows developers to see exactly what touch events are being registered
- Cleans up the UI by not showing empty log boxes

### Mobile Optimizations
- Robust mobile device detection using multiple methods:
  - Touch capability detection
  - User agent string analysis
  - Screen size and orientation awareness
- Touch event handling:
  - Prevented default scrolling and bouncing
  - Disabled unwanted touch gestures
  - Optimized touch response time
  - Proper viewport configuration
- UI Adaptations:
  - Semi-transparent D-pad with subtle borders
  - Centered bottom positioning for ergonomic access
  - Automatic WASD label hiding on mobile
  - Touch-friendly interaction areas
  - Microphone toggle button (described below)
- Debug log system:
  - Persistent log box at the top of screen with white text on black background
  - Only visible when there's actual log content to display
  - Real-time mobile detection and touch event logging
  - D-pad input state visualization
  - Helps diagnose issues with mobile controls across various devices
- Audio Playback:
  - Touch-based audio initialization
  - Proper handling of mobile audio constraints
  - Automatic domain detection for asset loading
  - Error recovery for interrupted playback
  - Debug logging for audio-related issues

### Microphone Toggle System
- Dual microphone buttons optimized for each device type:
  - Desktop/Web: Fixed button in bottom right corner
  - Mobile: Button positioned alongside D-pad controls
- Consistent visual state across devices:
  - Inactive: Semi-transparent gray background with white borders
  - Active: White background with white borders and black text
- Synchronized state management:
  - Both buttons maintain identical state when toggled
  - State is tracked in JavaScript and via visual appearance
  - Clear visual feedback through color change
- Implementation details:
  - Web button uses inline styles for guaranteed visibility
  - Mobile button integrates with the D-pad control group
  - Shared toggle function updates both buttons simultaneously
  - Real-time log messages indicate microphone state changes
  - High z-index ensures button visibility above other UI elements

### Dimensions and Collision System
- Room size: 30 units wide × 20 units deep × 4 units high
- Cabinet spacing: 2.5 units between cabinets
- Cabinet collision box dimensions:
  - Width: 1.0 units
  - Depth: 0.7 units
  - Height: 2.0 units
- Player collision radius: 0.3 units
- Collision detection uses Three.js Box3 for precise cabinet interactions
- Collision response prevents clipping and maintains consistent behavior from all angles

### Web Browser Implementation
- CSS3DRenderer used to render HTML content in 3D space
- Tabindex control to prevent automatic focus stealing
- Pointer events disabled by default, enabled only when browser is explicitly activated
- Interactive toggle system:
  - Browser requires an explicit click to become active
  - Active state toggled using click events
  - Visual indicators make interaction state clear to users
  - Automatic iframe blur when deactivated
- Uses scale transformations to match Three.js coordinate system
- Screen positioned using Three.js coordinates for perfect alignment
- Focus management ensures WASD controls remain functional at all times

### Current State
- Players spawn at random positions in the central arcade area with safe distance enforcement
- Intelligent collision handling prevents players from getting stuck together
- 7 cabinets arranged in two rows:
  - Front row: Cabinets 1-3 (Fly Pieter, Garden Club, Pizza Legends)
  - Back row: Cabinets 9-12 (Vibe Synth, Pixel Paint, Retro Racer, Pong)
- Cabinet numbers are placed directly on the floor, aligned with their respective cabinets
- VIBECADE neon sign is positioned on the south wall with proper spacing
- Ceiling is solid black without text
- Lighting system is fully functional with dynamic effects
- Collision system uses Three.js Box3 for accurate hit detection
- Multiplayer interactions with advanced position synchronization and collision response
- Commented-out features (preserved in code for future use):
  - 3D test button with pink glow and "TEST LOG" label
  - Interactive web browser screen for fly.pieter.com
  - Both features can be re-enabled by uncommenting their instantiation lines

## Troubleshooting

### Multiplayer Issues
- The WebSocket server runs on https://vibecade.glitch.me
- For local development:
  - Run the server on port 3000 (`npm run server`)
  - Server supports both HTTP and HTTPS modes
  - HTTPS requires SSL certificates (set via environment variables)
- Environment Variables for SSL:
  - `SSL_KEY_PATH`: Path to SSL private key
  - `SSL_CERT_PATH`: Path to SSL certificate
- If server shows "address already in use" error, kill the existing process:
  ```bash
  # Find the process using port 3000
  lsof -i :3000
  
  # Kill it using its PID
  kill <PID>
  ```

### Server Configuration
- The server automatically detects the environment and configures itself:
  - Production: Uses HTTPS with SSL certificates
  - Development: Falls back to HTTP if certificates aren't available
- CORS is configured for:
  - https://www.andrewos.com
  - https://vibe.andrewos.com
  - http://localhost:5173
- Node.js version: 16.x (specified in package.json)

### Mobile Controls
If mobile controls aren't working properly:
- Check that the device detection is working correctly
- Ensure touch events are being captured
- Review the debug log (if enabled) for touch event data

## Dependencies
- Three.js (v0.159.0)
- GSAP (v3.12.3)
- Socket.IO (v4.7.4)
- Socket.IO Client (v4.7.4)
- Express (v4.18.3)
- Vite (v3.2.7)
- Node.js (v16.x)

## Featured Games

First Row (1-8):
- **Fly Pieter** - The notorious flying game by @levelsio (https://fly.pieter.com/)
- **Garden Club** - A peaceful gardening simulator (https://garden.club/)
- **Pizza Legends** - A pizza-themed RPG adventure (https://pizza-legends.io/)
- **Vibe Synth** - Create chill music with this synth (https://vibe-synth.com/)
- **Pixel Paint** - Create pixel art masterpieces (https://pixel-paint.app/)
- **Retro Racer** - A vaporwave racing experience (https://retro-racer.io/)
- **Space Shooter** - Classic arcade space shooter
- **Neon Runner** - Endless runner in a neon world

Second Row (9-16):
- Mirrored versions of the first row games

## Technologies Used

- Three.js for 3D rendering and collision detection
- GSAP for animations
- Vite for development and building

## Getting Started

### Prerequisites

- Node.js (v16.x)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/vibecade.git
cd vibecade
```

2. Install dependencies:
```bash
npm install
# or
yarn
```

3. Start the development server:
```bash
# Start the WebSocket server
npm run server

# In a separate terminal, start the Vite dev server
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Production Setup

1. Build the client:
```bash
npm run build
# or
yarn build
```

2. Configure SSL (if using HTTPS):
- Set `SSL_KEY_PATH` environment variable to your SSL private key path
- Set `SSL_CERT_PATH` environment variable to your SSL certificate path

3. Start the production server:
```bash
npm start
```

The server will automatically detect the environment and use HTTPS if SSL certificates are available, falling back to HTTP if they're not.

### Publishing

To publish updates to vibe.andrewos.com:

1. Build the project:
```bash
npm run build
```

2. Copy the built files to the vibe directory:
```bash
cp -r dist/* vibe/
```

3. Commit and push the changes:
```bash
git add vibe/
git commit -m "Update vibe with [your changes]"
git push
```

The changes will be live at vibe.andrewos.com once the push is complete.