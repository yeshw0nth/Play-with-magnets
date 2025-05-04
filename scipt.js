const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const clearButton = document.getElementById('clearButton');
const eraserButton = document.getElementById('eraserButton');
const addParticlesButton = document.getElementById('addParticlesButton');
const strengthSlider = document.getElementById('magnetStrength');
const strengthValueSpan = document.getElementById('strengthValue');
const sizeSlider = document.getElementById('magnetSize');
const sizeValueSpan = document.getElementById('sizeValue');
const currentModeSpan = document.getElementById('currentMode');


// Set canvas size (adjust as needed)
canvas.width = 800;
canvas.height = 600;

// --- Configuration ---
const NUM_PARTICLES_INITIAL = 5000; // Initial number of particles
const PARTICLE_SIZE = 1;    // Size (radius) of each particle
const MAGNET_CLICK_TOLERANCE = 10; // How close a click needs to be to a magnet center to select it for dragging or erasing
const DAMPING_FACTOR = 0.98; // Reduces velocity each frame to simulate friction
const MAX_SPEED = 7;        // Limit particle speed (slightly increased)
const FORCE_CALC_DISTANCE_SQ = 200 * 200; // Square of distance where force is calculated (increased range for performance)
const ADD_PARTICLES_BATCH = 1000; // Number of particles to add with the button

// --- State ---
const particles = [];
const magnets = [];
let isDragging = false;
let draggedMagnet = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let isEraserMode = false; // New state for eraser tool

// Get initial values from sliders
let currentMagnetStrength = parseInt(strengthSlider.value);
let currentMagnetSize = parseInt(sizeSlider.value);

// --- Particle Class ---
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        // Give slightly more varied initial velocity
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
    }

    update() {
        let totalForceX = 0;
        let totalForceY = 0;

        for (const magnet of magnets) {
            const dx = magnet.x - this.x;
            const dy = magnet.y - this.y;
            const distSq = dx * dx + dy * dy; // Distance squared

            // Apply force only if within calculation distance and not right on top
            if (distSq < FORCE_CALC_DISTANCE_SQ && distSq > 1) {
                const distance = Math.sqrt(distSq);
                // Force magnitude: inversely proportional to distance squared * strength * polarity
                // Use magnet's individual strength and polarity
                const forceMagnitude = (magnet.strength / distSq) * magnet.polarity;

                // Calculate force components - direction is towards/away from magnet center
                totalForceX += (dx / distance) * forceMagnitude;
                totalForceY += (dy / distance) * forceMagnitude;
            }
        }

        // Apply force to velocity (using acceleration)
        this.vx += totalForceX;
        this.vy += totalForceY;

        // Apply damping (friction)
        this.vx *= DAMPING_FACTOR;
        this.vy *= DAMPING_FACTOR;

        // Limit speed
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > MAX_SPEED) {
            const ratio = MAX_SPEED / speed;
            this.vx *= ratio;
            this.vy *= ratio;
        }

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // --- Boundary Bouncing ---
        // Check if hit horizontal boundary
        if (this.x < 0) {
            this.x = 0; // Snap to boundary
            this.vx *= -1; // Reverse velocity
        } else if (this.x > canvas.width) {
            this.x = canvas.width; // Snap to boundary
            this.vx *= -1; // Reverse velocity
        }

        // Check if hit vertical boundary
        if (this.y < 0) {
            this.y = 0; // Snap to boundary
            this.vy *= -1; // Reverse velocity
        } else if (this.y > canvas.height) {
            this.y = canvas.height; // Snap to boundary
            this.vy *= -1; // Reverse velocity
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#333'; // Dark grey for powder
        ctx.beginPath();
        ctx.arc(this.x, this.y, PARTICLE_SIZE, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- Magnet Class ---
class Magnet {
    constructor(x, y, polarity, strength, size) {
        this.x = x;
        this.y = y;
        this.polarity = polarity; // 1 for attract, -1 for repel
        this.strength = strength; // Individual strength
        this.size = size;       // Individual size (radius)
        this.color = polarity === 1 ? 'rgba(255, 0, 0, 0.6)' : 'rgba(0, 0, 255, 0.6)'; // Red or Blue
        this.strokeColor = polarity === 1 ? 'red' : 'blue';
    }

    draw(ctx) {
        // Draw main circle
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); // Use individual size
        ctx.fill();

        // Draw outline
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw polarity indicator
        ctx.fillStyle = 'white';
        ctx.font = `${this.size}px Arial`; // Scale font with magnet size
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.polarity === 1 ? '+' : '-', this.x, this.y);
    }
}

// --- Initialization ---
function initParticles(num) {
     for (let i = 0; i < num; i++) {
         const x = Math.random() * canvas.width;
         const y = Math.random() * canvas.height;
         particles.push(new Particle(x, y));
     }
     console.log(`Added ${num} particles. Total: ${particles.length}`);
}

function resetSimulation() {
    magnets.length = 0; // Clear magnets
    particles.length = 0; // Clear particles
    initParticles(NUM_PARTICLES_INITIAL); // Add initial particles again
    isEraserMode = false; // Reset mode
    updateModeDisplay();
    canvas.classList.remove('cursor-eraser');
    canvas.classList.add('cursor-add-magnet'); // Set default cursor class
     eraserButton.classList.remove('active'); // Deactivate button style
}


// --- Animation Loop ---
function animate() {
    // --- Particle Trails ---
    // Draw a semi-transparent rectangle over the canvas each frame
    // This causes the previous frame's drawings to fade out, creating trails.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; // White with low alpha (adjust alpha for trail length)
    ctx.fillRect(0, 0, canvas.width, canvas.height);


    // 2. Update particle positions based on forces
    for (const particle of particles) {
        particle.update();
    }

    // 3. Draw everything (particles first, then magnets on top)
    for (const particle of particles) {
        particle.draw(ctx);
    }
    for (const magnet of magnets) {
        magnet.draw(ctx);
    }

    // 4. Request next frame
    requestAnimationFrame(animate);
}

// --- Helper Function: Get Mouse Position ---
function getMousePos(event) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
}

// --- Helper Function: Find Magnet Under Cursor ---
function findMagnetAt(x, y) {
     // Iterate backwards so we select the top-most magnet if they overlap
     for (let i = magnets.length - 1; i >= 0; i--) {
         const magnet = magnets[i];
         const dx = x - magnet.x;
         const dy = y - magnet.y;
         const distance = Math.sqrt(dx * dx + dy * dy);

         // Use magnet's size for hit detection + tolerance
         if (distance < magnet.size + MAGNET_CLICK_TOLERANCE) {
             return magnet; // Return the magnet object
         }
     }
     return null; // No magnet found
}

// --- UI State Updates ---
function updateModeDisplay() {
    currentModeSpan.textContent = `Current Mode: ${isEraserMode ? 'Eraser' : 'Add Magnets'}`;
}


// --- Event Listeners ---

// Prevent the default context menu on right-click over the canvas
canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});


// Handle mouse down (start dragging, add magnet, or erase)
canvas.addEventListener('mousedown', (event) => {
    const mousePos = getMousePos(event);

    if (isEraserMode) {
        // --- Eraser Logic ---
        const magnetToRemove = findMagnetAt(mousePos.x, mousePos.y);
        if (magnetToRemove) {
             // Find the index and remove it
             const index = magnets.indexOf(magnetToRemove);
             if (index > -1) {
                 magnets.splice(index, 1);
                 console.log('Removed magnet.');
             }
        }
    } else {
        // --- Add Magnet / Drag Logic ---
        const magnetToDrag = findMagnetAt(mousePos.x, mousePos.y);

        if (magnetToDrag) {
            // Clicked on a magnet - start dragging
            isDragging = true;
            draggedMagnet = magnetToDrag;
            dragOffsetX = mousePos.x - draggedMagnet.x; // Store offset
            dragOffsetY = mousePos.y - draggedMagnet.y;
            canvas.classList.remove('cursor-add-magnet'); // Remove other mode cursor
            canvas.classList.add('cursor-grabbing'); // Change cursor
        } else {
             // Clicked on empty space - add a new magnet
             isDragging = false; // Ensure dragging is false
             draggedMagnet = null; // Clear dragged magnet
             canvas.classList.remove('cursor-grabbing'); // Reset cursor
             canvas.classList.add('cursor-add-magnet'); // Ensure correct cursor for adding


             if (event.button === 2) { // Right mouse button
                 magnets.push(new Magnet(mousePos.x, mousePos.y, -1, currentMagnetStrength, currentMagnetSize)); // Repelling
                 console.log(`Added repelling magnet at (${mousePos.x}, ${mousePos.y})`);
             } else if (event.button === 0) { // Left mouse button
                 magnets.push(new Magnet(mousePos.x, mousePos.y, 1, currentMagnetStrength, currentMagnetSize)); // Attracting
                 console.log(`Added attracting magnet at (${mousePos.x}, ${mousePos.y})`);
             }
        }
    }
});

// Handle mouse move (drag the magnet)
canvas.addEventListener('mousemove', (event) => {
    if (isDragging && draggedMagnet) {
        const mousePos = getMousePos(event);
        // Update magnet position based on mouse and stored offset
        draggedMagnet.x = mousePos.x - dragOffsetX;
        draggedMagnet.y = mousePos.y - dragOffsetY;
    }
});

// Handle mouse up (stop dragging)
canvas.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        draggedMagnet = null;
        canvas.classList.remove('cursor-grabbing'); // Reset cursor
        // Set cursor back based on current mode (add or erase)
        if (isEraserMode) {
            canvas.classList.add('cursor-eraser');
        } else {
            canvas.classList.add('cursor-add-magnet');
        }
    }
});


// Handle slider changes
strengthSlider.addEventListener('input', (event) => {
    currentMagnetStrength = parseInt(event.target.value);
    strengthValueSpan.textContent = currentMagnetStrength;
});

sizeSlider.addEventListener('input', (event) => {
    currentMagnetSize = parseInt(event.target.value);
    sizeValueSpan.textContent = currentMagnetSize;
});


// Handle button clicks
clearButton.addEventListener('click', resetSimulation);

eraserButton.addEventListener('click', () => {
    isEraserMode = !isEraserMode; // Toggle eraser mode
    updateModeDisplay();
    if (isEraserMode) {
        canvas.classList.remove('cursor-add-magnet', 'cursor-grabbing');
        canvas.classList.add('cursor-eraser');
        eraserButton.classList.add('active'); // Style the button as active
    } else {
        canvas.classList.remove('cursor-eraser', 'cursor-grabbing');
         canvas.classList.add('cursor-add-magnet');
        eraserButton.classList.remove('active'); // Style the button as inactive
    }
});

addParticlesButton.addEventListener('click', () => {
    initParticles(ADD_PARTICLES_BATCH); // Add more particles
});


// --- Start the Simulation ---
resetSimulation(); // Initialize particles and state
animate(); // Start the animation loop
