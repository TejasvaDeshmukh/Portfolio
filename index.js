import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import confetti from 'canvas-confetti';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

/* =========================================================================
   CUSTOM CURSOR TRAIL
   ========================================================================= */
const cursor = document.getElementById('custom-cursor');
const cursorDot = document.getElementById('custom-cursor-dot');
let mouseX = 0;
let mouseY = 0;
let cursorX = 0;
let cursorY = 0;
let dotX = 0;
let dotY = 0;

window.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

// Animate cursor movement with lag/interpolation for smoothness
function animateCursor() {
  // Cursor outer ring interpolation
  const ringSpeed = 0.15;
  cursorX += (mouseX - cursorX) * ringSpeed;
  cursorY += (mouseY - cursorY) * ringSpeed;
  
  if (cursor) {
    cursor.style.left = `${cursorX}px`;
    cursor.style.top = `${cursorY}px`;
  }

  // Cursor inner dot interpolation (faster)
  const dotSpeed = 0.3;
  dotX += (mouseX - dotX) * dotSpeed;
  dotY += (mouseY - dotY) * dotSpeed;
  
  if (cursorDot) {
    cursorDot.style.left = `${dotX}px`;
    cursorDot.style.top = `${dotY}px`;
  }

  requestAnimationFrame(animateCursor);
}
animateCursor();

// Cursor hovering states
const interactiveElements = document.querySelectorAll('.interactive');
interactiveElements.forEach((el) => {
  el.addEventListener('mouseenter', () => {
    cursor.classList.add('hovering');
  });
  el.addEventListener('mouseleave', () => {
    cursor.classList.remove('hovering');
  });
});

/* =========================================================================
   THREE.JS 3D PARTICLE CONSTELLATION
   ========================================================================= */
let threeInitialized = false;
let scene, camera, renderer, starGeometry, starSystem;
let nodeGeometry, nodeSystem, lineGeometry, lineSystem;
const nodeCount = 115;
const nodes = [];
const nodeVelocities = [];

// Mouse input variables
let targetRotationX = 0;
let targetRotationY = 0;
let mouseNormX = 0;
let mouseNormY = 0;
let scrollYPercent = 0;

try {
  const canvas = document.getElementById('bg-canvas');
  if (canvas) {
    // Create Three.js Scene, Camera, and Renderer
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = 800;

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Dynamic texture generator for glowing circles
    function createCircleTexture(colorStr = '6, 182, 212') {
      const canvasTexture = document.createElement('canvas');
      canvasTexture.width = 32;
      canvasTexture.height = 32;
      const ctx = canvasTexture.getContext('2d');
      
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.2, `rgba(${colorStr}, 0.8)`);
      gradient.addColorStop(0.5, `rgba(${colorStr}, 0.3)`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
      
      return new THREE.CanvasTexture(canvasTexture);
    }

    const cyanTexture = createCircleTexture('90, 111, 98'); // Soft Sage Green
    const purpleTexture = createCircleTexture('161, 161, 170'); // Silver Zinc

    // 1. Background Dust Star System (Lots of small dots floating)
    const starCount = 400;
    starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 1600; // X
      starPositions[i+1] = (Math.random() - 0.5) * 1600; // Y
      starPositions[i+2] = (Math.random() - 0.5) * 1600; // Z
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: 4,
      map: purpleTexture,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });

    starSystem = new THREE.Points(starGeometry, starMaterial);
    scene.add(starSystem);

    // 2. Interactive Constellation (Fewer larger nodes connected by lines)
    for (let i = 0; i < nodeCount; i++) {
      nodes.push(new THREE.Vector3(
        (Math.random() - 0.5) * 1200,
        (Math.random() - 0.5) * 1200,
        (Math.random() - 0.5) * 1200
      ));
      nodeVelocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.8
      ));
    }

    // Geometry for lines
    lineGeometry = new THREE.BufferGeometry();
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xe4e4e7,
      transparent: true,
      opacity: 0.22
    });
    const linePositions = new Float32Array(nodeCount * nodeCount * 6);
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineSystem = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lineSystem);

    // Geometry for node dots
    nodeGeometry = new THREE.BufferGeometry();
    const nodePositions = new Float32Array(nodeCount * 3);
    nodeGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));

    const nodeMaterial = new THREE.PointsMaterial({
      size: 12,
      map: cyanTexture,
      transparent: true,
      opacity: 0.75,
      depthWrite: false
    });

    nodeSystem = new THREE.Points(nodeGeometry, nodeMaterial);
    scene.add(nodeSystem);

    window.addEventListener('mousemove', (e) => {
      mouseNormX = (e.clientX / window.innerWidth) - 0.5;
      mouseNormY = (e.clientY / window.innerHeight) - 0.5;
      
      targetRotationX = mouseNormY * 0.25;
      targetRotationY = mouseNormX * 0.25;
    });

    window.addEventListener('scroll', () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      scrollYPercent = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    });

    window.addEventListener('resize', () => {
      if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      }
    });

    threeInitialized = true;
  }
} catch (e) {
  console.warn("Three.js WebGL initialization failed. Running in 2D mode.", e);
  const container = document.getElementById('canvas-container');
  if (container) container.style.display = 'none';
}

// Animation Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  if (!threeInitialized) return;
  
  try {
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();

    // Slow float rotations of overall scenes
    starSystem.rotation.y = time * 0.015;
    starSystem.rotation.x = time * 0.008;

    // Linear interpolation for mouse tilt inertia
    nodeSystem.rotation.x += (targetRotationX - nodeSystem.rotation.x) * 0.05;
    nodeSystem.rotation.y += (targetRotationY - nodeSystem.rotation.y) * 0.05;
    lineSystem.rotation.x = nodeSystem.rotation.x;
    lineSystem.rotation.y = nodeSystem.rotation.y;

    // Move camera depth based on scroll position (fly-through effect)
    const targetCamZ = 800 - (scrollYPercent * 900);
    camera.position.z += (targetCamZ - camera.position.z) * 0.08;

    // Update background star positions (slow vertical drift)
    const starPosArr = starGeometry.attributes.position.array;
    for (let i = 1; i < 400 * 3; i += 3) {
      starPosArr[i] -= 0.12; // slow fall
      if (starPosArr[i] < -800) starPosArr[i] = 800; // wrap
    }
    starGeometry.attributes.position.needsUpdate = true;

    // Update interactive constellation nodes
    const nodePosArr = nodeGeometry.attributes.position.array;
    const boxDim = 600;

    for (let i = 0; i < nodeCount; i++) {
      const node = nodes[i];
      const vel = nodeVelocities[i];
      
      node.add(vel);

      // Apply attraction to cursor in 3D
      const cursor3D = new THREE.Vector3(
        mouseNormX * 800,
        -mouseNormY * 600,
        0
      );
      const distToCursor = node.distanceTo(cursor3D);
      if (distToCursor < 350) {
        const pullForce = (350 - distToCursor) * 0.0005;
        const pullVec = new THREE.Vector3().subVectors(cursor3D, node).normalize().multiplyScalar(pullForce);
        node.add(pullVec);
      }

      // Bounce off limits
      if (Math.abs(node.x) > boxDim) vel.x *= -1;
      if (Math.abs(node.y) > boxDim) vel.y *= -1;
      if (Math.abs(node.z) > boxDim) vel.z *= -1;

      nodePosArr[i * 3] = node.x;
      nodePosArr[i * 3 + 1] = node.y;
      nodePosArr[i * 3 + 2] = node.z;
    }
    nodeGeometry.attributes.position.needsUpdate = true;

    // Recalculate line connections
    let lineIdx = 0;
    const linePosArr = lineGeometry.attributes.position.array;
    const maxDistance = 220;

    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];
        const dist = nodeA.distanceTo(nodeB);
        
        if (dist < maxDistance) {
          linePosArr[lineIdx++] = nodeA.x;
          linePosArr[lineIdx++] = nodeA.y;
          linePosArr[lineIdx++] = nodeA.z;
          linePosArr[lineIdx++] = nodeB.x;
          linePosArr[lineIdx++] = nodeB.y;
          linePosArr[lineIdx++] = nodeB.z;
        }
      }
    }

    // Clear remaining lines
    for (let i = lineIdx; i < nodeCount * nodeCount * 6; i++) {
      linePosArr[i] = 0;
    }
    lineGeometry.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  } catch (err) {
    console.error("Error in Three.js loop, disabling 3D background", err);
    threeInitialized = false;
    const container = document.getElementById('canvas-container');
    if (container) container.style.display = 'none';
  }
}
animate();

// Handle Window Resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

/* =========================================================================
   TYPEWRITER EFFECT (HERO TITLE)
   ========================================================================= */
const typewriterElement = document.getElementById('typewriter-title');
const titles = [
  'AI & Machine Learning Professional',
  'Data Engineer & Solutions Builder',
  'Master of Business Analytics student'
];

let titleIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typeSpeed = 80;

function typeWriter() {
  const currentTitle = titles[titleIndex];
  
  if (isDeleting) {
    // Delete character
    typewriterElement.textContent = currentTitle.substring(0, charIndex - 1);
    charIndex--;
    typeSpeed = 40; // delete faster
  } else {
    // Type character
    typewriterElement.textContent = currentTitle.substring(0, charIndex + 1);
    charIndex++;
    typeSpeed = 80;
  }

  // Handle word completion states
  if (!isDeleting && charIndex === currentTitle.length) {
    // Pause at complete word
    isDeleting = true;
    typeSpeed = 2000;
  } else if (isDeleting && charIndex === 0) {
    // Move to next word
    isDeleting = false;
    titleIndex = (titleIndex + 1) % titles.length;
    typeSpeed = 500;
  }

  setTimeout(typeWriter, typeSpeed);
}

// Start Typewriter
setTimeout(typeWriter, 1000);

/* =========================================================================
   HEADER SCROLL EFFECT
   ========================================================================= */
const header = document.getElementById('header');
window.addEventListener('scroll', () => {
  if (window.scrollY > 50) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

/* =========================================================================
   GSAP HERO ENTRANCE & NATIVE OBSERVER SCROLL REVEALS
   ========================================================================= */
try {
  // Add a subtle entrance animation for hero content immediately on load
  gsap.from('#hero .hero-subtitle', { opacity: 0, y: -20, duration: 0.8, ease: 'power3.out', delay: 0.2 });
  gsap.from('#hero .hero-name', { opacity: 0, y: 30, duration: 1, ease: 'power4.out', delay: 0.4 });
  gsap.from('#hero .hero-desc', { opacity: 0, duration: 1.2, ease: 'power2.out', delay: 0.7 });
  gsap.from('#hero .hero-cta', { opacity: 0, y: 20, duration: 0.8, ease: 'power3.out', delay: 0.9 });
  gsap.from('#hero .scroll-indicator', { opacity: 0, duration: 0.8, delay: 1.2 });
} catch (e) {
  console.error("Hero animations failed", e);
}

// Native Intersection Observer for Scroll Reveals
try {
  const revealOptions = {
    root: null,
    rootMargin: '0px 0px -8% 0px', // Trigger reveal slightly before scroll frame boundary
    threshold: 0.05
  };

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target); // Reveal once
      }
    });
  }, revealOptions);

  // Bind Observer to all reveal-element, skills columns, and experience cards
  const elementsToObserve = document.querySelectorAll('.reveal-el, .skills-category, .timeline-item');
  elementsToObserve.forEach(el => {
    revealObserver.observe(el);
  });
} catch (e) {
  console.error("Intersection Observer reveals failed. Running fallback.", e);
  document.querySelectorAll('.reveal-el, .skills-category, .timeline-item').forEach(el => {
    el.style.opacity = '1';
    el.style.transform = 'none';
  });
}

// Section Active Glow Observer
try {
  const sectionOptions = {
    root: null,
    rootMargin: '-40% 0px -40% 0px', // Trigger when section occupies the center 20% viewport strip
    threshold: 0
  };

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active-section');
        console.log(`[Active Section] ${entry.target.id} is now glowing.`);
      } else {
        entry.target.classList.remove('active-section');
      }
    });
  }, sectionOptions);

  document.querySelectorAll('section').forEach(sec => {
    sectionObserver.observe(sec);
  });

  // Snappy click-handler to trigger glow instantly on nav links
  document.querySelectorAll('header nav a, .hero-cta a, .scroll-indicator').forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId && targetId.startsWith('#')) {
        const targetSec = document.querySelector(targetId);
        if (targetSec) {
          // Instantly activate targeted section and remove from all others
          document.querySelectorAll('section').forEach(sec => sec.classList.remove('active-section'));
          targetSec.classList.add('active-section');
          console.log(`[Click Glow Activation] Forced active-section glow on: ${targetId}`);
        }
      }
    });
  });
} catch (e) {
  console.error("Section active observer/click-glow failed", e);
}


// Projects items tilt micro-interaction on mouse move
const projectCards = document.querySelectorAll('.project-card');
projectCards.forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    try {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left; // x coordinate inside element
      const y = e.clientY - rect.top;  // y coordinate inside element
      
      // Calculate tilt angles based on mouse offsets (max 6 degrees)
      const tiltX = ((y / rect.height) - 0.5) * -12;
      const tiltY = ((x / rect.width) - 0.5) * 12;
      
      card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-4px)`;
    } catch (err) {
      // Ignore errors in hover animation
    }
  });
  
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
  });
});

/* =========================================================================
   CERTIFICATION CONFETTI MICRO-INTERACTION
   ========================================================================= */
const certCards = document.querySelectorAll('.cert-card');
certCards.forEach((card) => {
  card.addEventListener('mouseenter', () => {
    // Subtle mini burst
    try {
      confetti({
        particleCount: 20,
        spread: 40,
        origin: { y: 0.85 },
        colors: ['#5a6f62', '#4b5e6b', '#a1a1aa', '#b45309']
      });
    } catch (err) {
      console.warn("Confetti failed", err);
    }
  });
  
  card.addEventListener('click', () => {
    // Larger explosion on actual click!
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.7 },
        colors: ['#5a6f62', '#4b5e6b', '#a1a1aa', '#b45309']
      });
    } catch (err) {
      console.warn("Confetti failed", err);
    }
  });
});

/* =========================================================================
   CONTACT FORM VALIDATION & INTERACTION (WEB3FORMS EMAIL INTEGRATION)
   ========================================================================= */
const contactForm = document.getElementById('contact-form');
const submitBtn = document.getElementById('form-submit-btn');
const formStatus = document.getElementById('form-status');

// Web3Forms Configuration: Retrieve a free key from https://web3forms.com/ and paste it below
const WEB3FORMS_ACCESS_KEY = "c5d43a44-f756-4c2f-89b6-03f70b7cfeeb"; 

if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Check if the user needs to configure their access key
    if (WEB3FORMS_ACCESS_KEY === "YOUR_ACCESS_KEY_HERE") {
      formStatus.innerHTML = '⚠️ <strong>Integration Required:</strong> Get a free access key from <a href="https://web3forms.com" target="_blank" style="color: inherit; text-decoration: underline;">Web3Forms</a> and set the <code>WEB3FORMS_ACCESS_KEY</code> constant in <code>index.js</code> to receive emails.';
      formStatus.className = 'form-status error';
      formStatus.style.display = 'block';
      return;
    }
    
    // Visual button working state
    submitBtn.innerHTML = 'Sending Transmission... <svg class="icon animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>';
    submitBtn.disabled = true;
    formStatus.style.display = 'none';

    // Prepare payload
    const formData = new FormData(contactForm);
    formData.append("access_key", WEB3FORMS_ACCESS_KEY);
    formData.append("subject", `New Portfolio Message from ${formData.get("name")}`);
    formData.append("from_name", "Tejasva's AI Portfolio");

    // Convert FormData to JSON
    const object = Object.fromEntries(formData);
    const json = JSON.stringify(object);

    fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: json
    })
    .then(async (response) => {
      let res = await response.json();
      if (response.status === 200) {
        // Success: Trigger celebratory confetti!
        try {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.65 },
            colors: ['#5a6f62', '#4b5e6b', '#a1a1aa', '#b45309']
          });
        } catch (err) {
          console.warn("Confetti failed", err);
        }
        
        formStatus.textContent = 'Transmission received successfully! Tejasva will receive your message shortly.';
        formStatus.className = 'form-status success';
        formStatus.style.display = 'block';
        contactForm.reset();
      } else {
        // API level error
        console.error(res);
        formStatus.textContent = res.message || 'Transmission failed. Something went wrong.';
        formStatus.className = 'form-status error';
        formStatus.style.display = 'block';
      }
    })
    .catch((error) => {
      console.error(error);
      formStatus.textContent = 'Network error. Could not connect to transmission relays.';
      formStatus.className = 'form-status error';
      formStatus.style.display = 'block';
    })
    .finally(() => {
      // Re-enable submit button
      submitBtn.innerHTML = 'Send Transmission <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
      submitBtn.disabled = false;
      
      // Auto-hide the message after 8 seconds
      setTimeout(() => {
        formStatus.style.display = 'none';
      }, 8000);
    });
  });
}

/* =========================================================================
   CERTIFICATION FILTER TABS LOGIC
   ========================================================================= */
try {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const certCardsList = document.querySelectorAll('.cert-card');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle active class on buttons
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.getAttribute('data-filter');

      certCardsList.forEach(card => {
        const category = card.getAttribute('data-category');
        if (filter === 'all' || category === filter) {
          card.classList.remove('hidden');
          // Simple delay to allow smooth CSS scale-fade reveals
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'scale(1)';
          }, 30);
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });
} catch (e) {
  console.warn("Certifications filter initialization failed", e);
}


