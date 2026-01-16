// ===== Constants =====
const STICKER_WIDTH = 370;
const STICKER_HEIGHT = 320;
const MAX_STICKERS = 40;

// ===== State =====
let currentImage = null;
let imageTransform = {
    x: STICKER_WIDTH / 2,
    y: STICKER_HEIGHT / 2,
    scale: 1,
    rotation: 0
};
let dragState = {
    isDragging: false,
    type: null, // 'image', 'text', 'effect'
    index: -1,
    startPos: { x: 0, y: 0 }
};
let textElements = [];
let effectElements = [];
let backgroundColor = 'transparent';
let stickerCollection = [];
let selectedElement = { type: null, index: -1 };

let cropper = null;
let freeHandState = {
    isDrawing: false,
    points: [],
    scale: 1,
    offsetX: 0,
    offsetY: 0
};

// ===== DOM Elements =====
const canvas = document.getElementById('mainCanvas');
const ctx = canvas ? canvas.getContext('2d', { willReadFrequently: true }) : null;
const canvasContainer = document.querySelector('.canvas-container');
const uploadPrompt = document.getElementById('uploadPrompt');
const textInput = document.getElementById('textInput');
const addTextBtn = document.getElementById('addTextBtn');
const textColor = document.getElementById('textColor');
const fontWeight = document.getElementById('fontWeight');
const globalSize = document.getElementById('globalSize');
const globalSizeValue = document.getElementById('globalSizeValue');
const globalRotation = document.getElementById('globalRotation');
const globalRotationValue = document.getElementById('globalRotationValue');
const transparentBg = document.getElementById('transparentBg');
const whiteBg = document.getElementById('whiteBg');
const bgColor = document.getElementById('bgColor');
const saveSticker = document.getElementById('saveSticker');
const downloadCurrent = document.getElementById('downloadCurrent');
const resetBtn = document.getElementById('resetBtn');
const stickerGrid = document.getElementById('stickerGrid');
const stickerCount = document.getElementById('stickerCount');
const clearAllBtn = document.getElementById('clearAllBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const effectSelect = document.getElementById('effectSelect');
const addEffectBtn = document.getElementById('addEffectBtn');

// Crop Elements
const cropBtn = document.getElementById('cropBtn');
const cropModal = document.getElementById('cropModal');
const cropImage = document.getElementById('cropImage');
const closeCropBtn = document.getElementById('closeCropBtn');
const cancelCropBtn = document.getElementById('cancelCropBtn');
const applyCropBtn = document.getElementById('applyCropBtn');

// Freehand Crop Elements
const freeHandBtn = document.getElementById('freeHandBtn');
const freeHandModal = document.getElementById('freeHandModal');
const freeHandCanvas = document.getElementById('freeHandCanvas');
const freeHandCtx = freeHandCanvas.getContext('2d');
const closeFreeHandBtn = document.getElementById('closeFreeHandBtn');
const resetFreeHandBtn = document.getElementById('resetFreeHandBtn');
const cancelFreeHandBtn = document.getElementById('cancelFreeHandBtn');
const keepInsideBtn = document.getElementById('keepInsideBtn');
const removeInsideBtn = document.getElementById('removeInsideBtn');

// Auto Cutout Elements
const autoCutBtn = document.getElementById('autoCutBtn');

// ===== Initialize =====
function init() {
    // alert('Starting App...'); // Debug
    setupEventListeners();
    updateCanvas();
    loadFromLocalStorage(); // Load saved stickers
}

// ===== Local Storage =====
function saveToLocalStorage() {
    try {
        localStorage.setItem('lineStickers', JSON.stringify(stickerCollection));
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
        // Alert if storage is full
        if (e.name === 'QuotaExceededError') {
            alert('保存容量がいっぱいです。古いスタンプを削除してください。');
        }
    }
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('lineStickers');
        if (saved) {
            stickerCollection = JSON.parse(saved);
            renderStickerGrid();
            updateStickerCount();
        }
    } catch (e) {
        console.error('Failed to load from localStorage:', e);
    }
}

// ===== Event Listeners =====
function setupEventListeners() {
    // File upload - only when clicking the upload prompt
    uploadPrompt.addEventListener('click', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => handleImageUpload(e.target.files[0]);
        input.click();
    });

    // Drag and drop
    canvasContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        canvasContainer.style.borderColor = 'var(--primary)';
    });

    canvasContainer.addEventListener('dragleave', () => {
        canvasContainer.style.borderColor = 'var(--border)';
    });

    canvasContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        canvasContainer.style.borderColor = 'var(--border)';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageUpload(file);
        }
    });

    // Canvas interaction for dragging
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    canvas.addEventListener('mouseleave', handleCanvasMouseUp);
    canvas.addEventListener('dblclick', handleCanvasDoubleClick);

    // Touch support for iPad/tablets
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        canvas.dispatchEvent(mouseEvent);
    }, { passive: false });

    canvas.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        canvas.dispatchEvent(mouseEvent);
    }, { passive: false });

    // Text controls
    addTextBtn.addEventListener('click', addText);
    textInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addText();
    });

    // Unified controls (Global Size & Rotation)
    globalSize.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);

        if (selectedElement.type === 'text') {
            textElements[selectedElement.index].size = value;
            globalSizeValue.textContent = `${value}px`;
        } else if (selectedElement.type === 'effect') {
            effectElements[selectedElement.index].size = value;
            globalSizeValue.textContent = `${value}px`;
        } else {
            // Default to image scale if nothing or image selected
            imageTransform.scale = value / 100;
            globalSizeValue.textContent = `${value}%`;
        }
        updateCanvas();
    });

    globalRotation.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        globalRotationValue.textContent = `${value}°`;

        if (selectedElement.type === 'text') {
            textElements[selectedElement.index].rotation = value;
        } else if (selectedElement.type === 'effect') {
            effectElements[selectedElement.index].rotation = value;
        } else {
            imageTransform.rotation = value;
        }
        updateCanvas();
    });

    textColor.addEventListener('change', (e) => {
        if (selectedElement.type === 'text' && textElements[selectedElement.index]) {
            textElements[selectedElement.index].color = e.target.value;
            updateCanvas();
        }
    });

    fontWeight.addEventListener('change', (e) => {
        if (selectedElement.type === 'text' && textElements[selectedElement.index]) {
            textElements[selectedElement.index].weight = e.target.value;
            updateCanvas();
        }
    });

    // Image transform controls removed (moved to global)

    // Background controls
    transparentBg.addEventListener('click', () => {
        backgroundColor = 'transparent';
        updateCanvas();
    });

    whiteBg.addEventListener('click', () => {
        backgroundColor = '#ffffff';
        updateCanvas();
    });

    bgColor.addEventListener('change', (e) => {
        backgroundColor = e.target.value;
        updateCanvas();
    });

    // Effect size control removed (moved to global)

    // Effect controls
    if (addEffectBtn) {
        addEffectBtn.addEventListener('click', () => {
            const effect = effectSelect.value;
            if (effect) {
                addEffect(effect);
                effectSelect.value = ''; // Reset after adding
            }
        });
    }

    // Action buttons
    saveSticker.addEventListener('click', saveToCollection);
    downloadCurrent.addEventListener('click', downloadCurrentSticker);
    if (resetBtn) resetBtn.addEventListener('click', resetCanvas);
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllStickers);

    // Sticker Grid Event Delegation (for Delete Buttons)
    stickerGrid.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.stopPropagation();
            const id = Number(deleteBtn.dataset.id);
            deleteSticker(id);
        }
    });

    // downloadAllBtn is handled by onclick in HTML to ensure reliability

    // Crop events
    if (cropBtn) {
        cropBtn.addEventListener('click', startCrop);
        closeCropBtn.addEventListener('click', closeCropModal);
        cancelCropBtn.addEventListener('click', closeCropModal);
        applyCropBtn.addEventListener('click', applyCrop);
    }

    // Freehand Crop events
    if (freeHandBtn) {
        if (freeHandBtn) freeHandBtn.addEventListener('click', startFreeHand);
        if (closeFreeHandBtn) closeFreeHandBtn.addEventListener('click', closeFreeHandModal);
        if (cancelFreeHandBtn) cancelFreeHandBtn.addEventListener('click', closeFreeHandModal);
        if (resetFreeHandBtn) resetFreeHandBtn.addEventListener('click', resetFreeHand);
        if (keepInsideBtn) keepInsideBtn.addEventListener('click', () => applyFreeHand('keep'));
        if (removeInsideBtn) removeInsideBtn.addEventListener('click', () => applyFreeHand('remove'));

        // Drawing events
        if (freeHandCanvas) {
            freeHandCanvas.addEventListener('mousedown', handleFreeHandMouseDown);
            freeHandCanvas.addEventListener('mousemove', handleFreeHandMouseMove);
            freeHandCanvas.addEventListener('mouseup', handleFreeHandMouseUp);
            freeHandCanvas.addEventListener('mouseleave', handleFreeHandMouseUp);
        }
    }

    // Auto Cutout events
    if (autoCutBtn) {
        autoCutBtn.addEventListener('click', autoCutout);
    }
}

// ===== Image Upload =====
function handleImageUpload(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            currentImage = img;
            // Reset transform when new image is loaded
            const scale = Math.min(
                STICKER_WIDTH / img.width,
                STICKER_HEIGHT / img.height
            );
            imageTransform = {
                x: STICKER_WIDTH / 2,
                y: STICKER_HEIGHT / 2,
                scale: scale,
                rotation: 0
            };
            if (globalSize) {
                globalSize.value = Math.round(scale * 100);
                globalSizeValue.textContent = `${Math.round(scale * 100)}%`;
            }
            if (globalRotation) {
                globalRotation.value = 0;
                globalRotationValue.textContent = '0°';
            }
            if (cropBtn) cropBtn.disabled = false;
            if (freeHandBtn) freeHandBtn.disabled = false;
            if (autoCutBtn) autoCutBtn.disabled = false;
            uploadPrompt.classList.add('hidden');
            updateCanvas();
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ===== Canvas Drawing =====
function updateCanvas() {
    // Content state check for upload prompt visibility
    const hasContent = currentImage || textElements.length > 0 || effectElements.length > 0 || backgroundColor !== 'transparent';
    if (hasContent) {
        uploadPrompt.classList.add('hidden');
    } else {
        uploadPrompt.classList.remove('hidden');
    }
    // Update container background class for visual feedback
    if (backgroundColor === 'transparent') {
        canvasContainer.classList.add('transparent-mode');
    } else {
        canvasContainer.classList.remove('transparent-mode');
    }

    // Clear canvas
    ctx.clearRect(0, 0, STICKER_WIDTH, STICKER_HEIGHT);

    // Draw background
    if (backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, STICKER_WIDTH, STICKER_HEIGHT);
    }

    // Draw image with transformations
    if (currentImage) {
        ctx.save();
        ctx.translate(imageTransform.x, imageTransform.y);
        ctx.rotate((imageTransform.rotation * Math.PI) / 180);
        ctx.scale(imageTransform.scale, imageTransform.scale);

        ctx.drawImage(
            currentImage,
            -currentImage.width / 2,
            -currentImage.height / 2,
            currentImage.width,
            currentImage.height
        );
        ctx.restore();
    }

    // Draw text
    textElements.forEach((text, index) => {
        ctx.save();

        // Apply rotation
        ctx.translate(text.x, text.y);
        ctx.rotate((text.rotation * Math.PI) / 180);

        ctx.font = `${text.weight} ${text.size}px 'Noto Sans JP', sans-serif`;
        ctx.fillStyle = text.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Add stroke for better visibility
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 18;
        ctx.strokeText(text.content, 0, 0);
        ctx.fillText(text.content, 0, 0);

        // Draw bounding box if selected
        if (selectedElement.type === 'text' && selectedElement.index === index) {
            const metrics = ctx.measureText(text.content);
            const textWidth = metrics.width;
            const textHeight = text.size;
            ctx.strokeStyle = '#6366F1'; // Primary color
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(-textWidth / 2 - 10, -textHeight / 2 - 10, textWidth + 20, textHeight + 20);
            ctx.setLineDash([]);
        }

        ctx.restore();
    });

    // Draw effects
    effectElements.forEach((effect, index) => {
        ctx.save();
        ctx.translate(effect.x, effect.y);
        ctx.rotate(((effect.rotation || 0) * Math.PI) / 180);

        ctx.font = `${effect.size}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(effect.emoji, 0, 0);

        // Draw bounding box if selected
        if (selectedElement.type === 'effect' && selectedElement.index === index) {
            const effectRadius = effect.size / 2;
            ctx.strokeStyle = '#6366F1'; // Primary color
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(-effectRadius - 5, -effectRadius - 5, effect.size + 10, effect.size + 10);
            ctx.setLineDash([]);
        }
        ctx.restore();
    });
}

// Debugging: Catch global errors
window.onerror = function (msg, url, line, col, error) {
    alert(`Error: ${msg}\nLine: ${line}\nCol: ${col}`);
    return false;
};

// ===== Text Management =====
function addText() {
    const content = textInput.value.trim();
    if (!content) return;

    const text = {
        content: content,
        x: STICKER_WIDTH / 2,
        y: currentImage ? STICKER_HEIGHT - 40 : STICKER_HEIGHT / 2,
        size: 40, // Default font size
        color: textColor.value,
        weight: fontWeight.value,
        rotation: 0
    };

    textElements.push(text);
    textInput.value = '';

    // Select the new text automatically
    selectedElement = { type: 'text', index: textElements.length - 1 };
    updateControlsForSelection();
    updateCanvas();
}

// ===== Effect Management =====
function addEffect(effectType) {
    const effectEmojis = {
        sweat: '💦',
        tears: '😢',
        heart: '❤️',
        star: '⭐',
        anger: '💢',
        zzz: '💤',
        sparkle: '✨',
        note: '🎵',
        exclam: '❗',
        question: '❓',
        laugh: '😆',
        thumbsup: '👍',
        fire: '🔥',
        skull: '💀',
        bulb: '💡',
        ok: '⭕',
        ng: '❌',
        thinking: '🤔'
    };

    const effect = {
        emoji: effectEmojis[effectType],
        x: Math.random() * (STICKER_WIDTH - 60) + 30,
        y: Math.random() * (STICKER_HEIGHT - 60) + 30,
        size: 40, // Default effect size
        rotation: 0
    };

    effectElements.push(effect);

    // Select the new effect automatically
    selectedElement = { type: 'effect', index: effectElements.length - 1 };
    updateControlsForSelection();
    updateCanvas();
}

// ===== Canvas Interaction =====
function handleCanvasMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Default to deselecting
    let elementFound = false;

    // Check text elements (reverse order to prioritize top elements)
    for (let i = textElements.length - 1; i >= 0; i--) {
        const text = textElements[i];
        ctx.font = `${text.weight} ${text.size}px 'Noto Sans JP', sans-serif`;
        const metrics = ctx.measureText(text.content);
        const textWidth = metrics.width;
        const textHeight = text.size;

        // Transform mouse point to local space of text
        const dx = mouseX - text.x;
        const dy = mouseY - text.y;
        const angle = -(text.rotation || 0) * Math.PI / 180;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

        if (localX > -textWidth / 2 - 10 && localX < textWidth / 2 + 10 &&
            localY > -textHeight / 2 - 10 && localY < textHeight / 2 + 10) {
            dragState = {
                isDragging: true,
                type: 'text',
                index: i,
                startPos: { x: mouseX, y: mouseY }
            };
            selectedElement = { type: 'text', index: i };
            elementFound = true;
            canvas.style.cursor = 'grabbing';
            updateControlsForSelection();
            updateCanvas();
            return;
        }
    }

    // Check effect elements (reverse order to prioritize top elements)
    for (let i = effectElements.length - 1; i >= 0; i--) {
        const effect = effectElements[i];
        const effectRadius = effect.size / 2;

        // Transform mouse point to local space of effect
        const dx = mouseX - effect.x;
        const dy = mouseY - effect.y;
        const angle = -(effect.rotation || 0) * Math.PI / 180;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

        if (localX > -effectRadius - 10 && localX < effectRadius + 10 &&
            localY > -effectRadius - 10 && localY < effectRadius + 10) {
            dragState = {
                isDragging: true,
                type: 'effect',
                index: i,
                startPos: { x: mouseX, y: mouseY }
            };
            selectedElement = { type: 'effect', index: i };
            elementFound = true;
            canvas.style.cursor = 'grabbing';
            updateControlsForSelection();
            updateCanvas();
            return;
        }
    }

    // Check image
    if (currentImage) {
        const dx = mouseX - imageTransform.x;
        const dy = mouseY - imageTransform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const imageRadius = Math.max(currentImage.width, currentImage.height) * imageTransform.scale / 2;

        if (distance < imageRadius) {
            dragState = {
                isDragging: true,
                type: 'image',
                index: -1,
                startPos: { x: mouseX, y: mouseY }
            };
            // When image is dragged, deselect any other element
            selectedElement = { type: null, index: -1 };
            elementFound = true;
            canvas.style.cursor = 'grabbing';
            updateControlsForSelection();
            updateCanvas();
            return;
        }
    }

    // If no element was found, deselect
    if (!elementFound) {
        selectedElement = { type: null, index: -1 };
        updateControlsForSelection();
        updateCanvas();
    }
}

function handleCanvasMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    if (dragState.isDragging) {
        const dx = mouseX - dragState.startPos.x;
        const dy = mouseY - dragState.startPos.y;

        if (dragState.type === 'image') {
            imageTransform.x += dx;
            imageTransform.y += dy;
        } else if (dragState.type === 'text') {
            textElements[dragState.index].x += dx;
            textElements[dragState.index].y += dy;
        } else if (dragState.type === 'effect') {
            effectElements[dragState.index].x += dx;
            effectElements[dragState.index].y += dy;
        }

        dragState.startPos = { x: mouseX, y: mouseY };
        updateCanvas();
    } else {
        // Update cursor based on hover
        let hovering = false;

        // Check text hover
        for (let i = textElements.length - 1; i >= 0; i--) {
            const text = textElements[i];
            ctx.font = `${text.weight} ${text.size}px 'Noto Sans JP', sans-serif`;
            const metrics = ctx.measureText(text.content);
            const textWidth = metrics.width;
            const textHeight = text.size;

            // Transform mouse point to local space of text
            const dx = mouseX - text.x;
            const dy = mouseY - text.y;
            const angle = -(text.rotation || 0) * Math.PI / 180;
            const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
            const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

            if (localX > -textWidth / 2 - 10 && localX < textWidth / 2 + 10 &&
                localY > -textHeight / 2 - 10 && localY < textHeight / 2 + 10) {
                hovering = true;
                break;
            }
        }

        // Check effect hover
        if (!hovering) {
            for (let i = effectElements.length - 1; i >= 0; i--) {
                const effect = effectElements[i];
                const effectRadius = effect.size / 2;

                // Transform mouse point to local space
                const dx = mouseX - effect.x;
                const dy = mouseY - effect.y;
                const angle = -(effect.rotation || 0) * Math.PI / 180;
                const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
                const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

                if (localX > -effectRadius - 10 && localX < effectRadius + 10 &&
                    localY > -effectRadius - 10 && localY < effectRadius + 10) {
                    hovering = true;
                    break;
                }
            }
        }

        // Check image hover
        if (!hovering && currentImage) {
            const dx = mouseX - imageTransform.x;
            const dy = mouseY - imageTransform.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const imageRadius = Math.max(currentImage.width, currentImage.height) * imageTransform.scale / 2;

            if (distance < imageRadius) {
                hovering = true;
            }
        }

        canvas.style.cursor = hovering ? 'grab' : 'default';
    }
}

function handleCanvasMouseUp() {
    if (dragState.isDragging) {
        dragState = {
            isDragging: false,
            type: null,
            index: -1,
            startPos: { x: 0, y: 0 }
        };
        canvas.style.cursor = 'default';
        // Don't deselect on mouse up, keep the selection
    }
}

function handleCanvasDoubleClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Check text (reverse order)
    for (let i = textElements.length - 1; i >= 0; i--) {
        const text = textElements[i];
        ctx.font = `${text.weight} ${text.size}px 'Noto Sans JP', sans-serif`;
        const metrics = ctx.measureText(text.content);
        const textWidth = metrics.width;
        const textHeight = text.size;

        // Transform mouse point to local space of text
        const dx = mouseX - text.x;
        const dy = mouseY - text.y;
        const angle = -(text.rotation || 0) * Math.PI / 180;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

        if (localX > -textWidth / 2 - 10 && localX < textWidth / 2 + 10 &&
            localY > -textHeight / 2 - 10 && localY < textHeight / 2 + 10) {
            if (confirm('このテキストを削除しますか?')) {
                textElements.splice(i, 1);
                selectedElement = { type: null, index: -1 }; // Deselect after deletion
                updateCanvas();
                updateControlsForSelection();
            }
            return;
        }
    }

    // Check effects (reverse order)
    for (let i = effectElements.length - 1; i >= 0; i--) {
        const effect = effectElements[i];
        const effectRadius = effect.size / 2;

        // Transform mouse point to local space
        const dx = mouseX - effect.x;
        const dy = mouseY - effect.y;
        const angle = -(effect.rotation || 0) * Math.PI / 180;
        const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
        const localY = dx * Math.sin(angle) + dy * Math.cos(angle);

        if (localX > -effectRadius - 10 && localX < effectRadius + 10 &&
            localY > -effectRadius - 10 && localY < effectRadius + 10) {
            if (confirm('このエフェクトを削除しますか?')) {
                effectElements.splice(i, 1);
                selectedElement = { type: null, index: -1 }; // Deselect after deletion
                updateCanvas();
                updateControlsForSelection();
            }
            return;
        }
    }
}

function updateControlsForSelection() {
    if (selectedElement.type === 'text' && textElements[selectedElement.index]) {
        const text = textElements[selectedElement.index];
        globalSize.min = 10;
        globalSize.max = 100;
        globalSize.value = text.size;
        globalSizeValue.textContent = `${text.size}px`;

        globalRotation.value = text.rotation || 0;
        globalRotationValue.textContent = `${text.rotation || 0}°`;

        textColor.value = text.color;
        fontWeight.value = text.weight;
    } else if (selectedElement.type === 'effect' && effectElements[selectedElement.index]) {
        const effect = effectElements[selectedElement.index];
        globalSize.min = 10;
        globalSize.max = 200;
        globalSize.value = effect.size;
        globalSizeValue.textContent = `${effect.size}px`;

        globalRotation.value = effect.rotation || 0;
        globalRotationValue.textContent = `${effect.rotation || 0}°`;
    } else {
        // Image or no selection
        globalSize.min = 10;
        globalSize.max = 200;
        globalSize.value = Math.round(imageTransform.scale * 100);
        globalSizeValue.textContent = `${Math.round(imageTransform.scale * 100)}%`;

        globalRotation.value = imageTransform.rotation;
        globalRotationValue.textContent = `${imageTransform.rotation}°`;
    }
}

// ===== Reset =====
function resetCanvas() {
    if (!confirm('エディターをリセットしますか?')) return;

    currentImage = null;
    imageTransform = {
        x: STICKER_WIDTH / 2,
        y: STICKER_HEIGHT / 2,
        scale: 1,
        rotation: 0
    };

    globalSize.value = 100;
    globalSizeValue.textContent = '100%';
    globalRotation.value = 0;
    globalRotationValue.textContent = '0°';
    textElements = [];
    effectElements = [];
    backgroundColor = 'transparent';
    uploadPrompt.classList.remove('hidden');
    canvas.style.cursor = 'default';
    updateCanvas();
}

// ===== Save to Collection =====
function saveToCollection() {
    if (!currentImage && textElements.length === 0 && effectElements.length === 0) {
        alert('スタンプに追加する内容がありません');
        return;
    }

    if (stickerCollection.length >= MAX_STICKERS) {
        alert(`最大${MAX_STICKERS}個までしか保存できません`);
        return;
    }

    // Create a copy of current canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = STICKER_WIDTH;
    tempCanvas.height = STICKER_HEIGHT;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    const dataUrl = tempCanvas.toDataURL('image/png');

    const sticker = {
        id: Date.now(),
        dataUrl: dataUrl,
        timestamp: new Date().toLocaleString('ja-JP')
    };

    stickerCollection.push(sticker);
    saveToLocalStorage();
    renderStickerGrid();
    updateStickerCount();

    // Show success feedback
    saveSticker.textContent = '✓ 保存しました!';
    setTimeout(() => {
        saveSticker.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V7L17 3ZM19 19H5V5H16.17L19 7.83V19ZM12 12C10.34 12 9 13.34 9 15C9 16.66 10.34 18 12 18C13.66 18 15 16.66 15 15C15 13.34 13.66 12 12 12ZM6 6H15V10H6V6Z" fill="currentColor"/>
            </svg>
            スタンプを保存
        `;
    }, 2000);
}

// ===== Render Sticker Grid =====
function renderStickerGrid() {
    if (stickerCollection.length === 0) {
        stickerGrid.innerHTML = `
            <div class="empty-state">
                <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 8V12M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <p>まだスタンプがありません</p>
                <p class="empty-hint">左のエディターでスタンプを作成してください</p>
            </div>
        `;
        return;
    }

    stickerGrid.innerHTML = stickerCollection.map(sticker => `
        <div class="sticker-item" data-id="${sticker.id}">
            <img src="${sticker.dataUrl}" alt="Sticker">
            <button class="edit-btn" data-id="${sticker.id}" title="再編集">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/>
                </svg>
            </button>
            <button class="delete-btn" data-id="${sticker.id}" title="削除">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
                </svg>
            </button>
        </div>
    `).join('');

    // Attach event listeners directly to buttons
    stickerGrid.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = Number(btn.dataset.id);
            deleteSticker(id);
        });
    });

    stickerGrid.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = Number(btn.dataset.id);
            editSticker(id);
        });
    });
}

// ===== Edit Sticker =====
function editSticker(id) {
    const sticker = stickerCollection.find(s => s.id === id);
    if (!sticker) return;

    if (currentImage || textElements.length > 0 || effectElements.length > 0) {
        if (!confirm('現在の作業内容は上書きされます。このスタンプを再編集しますか？')) {
            return;
        }
    }

    const img = new Image();
    img.onload = () => {
        currentImage = img;
        // Reset transform
        const scale = Math.min(
            STICKER_WIDTH / img.width,
            STICKER_HEIGHT / img.height
        );
        imageTransform = {
            x: STICKER_WIDTH / 2,
            y: STICKER_HEIGHT / 2,
            scale: scale,
            rotation: 0
        };

        // Clear other elements as they are flattened in the saved image
        textElements = [];
        effectElements = [];
        backgroundColor = 'transparent';

        // Reset UI controls
        if (globalSize) {
            globalSize.value = Math.round(scale * 100);
            globalSizeValue.textContent = `${Math.round(scale * 100)}%`;
        }
        if (globalRotation) {
            globalRotation.value = 0;
            globalRotationValue.textContent = '0°';
        }
        if (cropBtn) cropBtn.disabled = false;
        if (freeHandBtn) freeHandBtn.disabled = false;
        if (autoCutBtn) autoCutBtn.disabled = false;

        uploadPrompt.classList.add('hidden');

        updateCanvas();

        // Brief feedback
        alert('スタンプをエディターに読み込みました。\n(テキストやスタンプは画像化されています)');
    };
    img.src = sticker.dataUrl;
}

// ===== Delete Sticker =====
function deleteSticker(id) {
    if (!confirm('このスタンプを削除しますか?')) return;

    stickerCollection = stickerCollection.filter(s => s.id !== id);
    saveToLocalStorage();
    renderStickerGrid();
    updateStickerCount();
}

// ===== Clear All Stickers =====
function clearAllStickers() {
    if (stickerCollection.length === 0) return;

    if (!confirm(`全ての${stickerCollection.length}個のスタンプを削除しますか?`)) return;

    stickerCollection = [];
    saveToLocalStorage();
    renderStickerGrid();
    updateStickerCount();
}

// ===== Update Sticker Count =====
function updateStickerCount() {
    stickerCount.textContent = stickerCollection.length;
}

// ===== Download Current Sticker =====
function downloadCurrentSticker() {
    if (!currentImage && textElements.length === 0 && effectElements.length === 0) {
        alert('ダウンロードする内容がありません');
        return;
    }

    const link = document.createElement('a');
    link.download = `line-sticker-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// ===== Download All Stickers (ZIP) =====
let isDownloading = false;



async function downloadAllStickers() {
    if (isDownloading) return;

    if (stickerCollection.length === 0) {
        alert('ダウンロードするスタンプがありません');
        return;
    }

    if (!confirm(`${stickerCollection.length}個のスタンプを1枚ずつダウンロードフォルダに保存します。\n(※多くのファイルが保存されます。ブラウザのダウンロード許可が必要な場合があります。)\n\nよろしいですか？`)) {
        return;
    }

    isDownloading = true;
    downloadAllBtn.disabled = true;
    const originalBtnText = downloadAllBtn.innerHTML;
    downloadAllBtn.innerHTML = `
        <svg viewBox="0 0 24 24" class="animate-spin" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4V2A10 10 0 002 12h2a8 8 0 018-8z" fill="currentColor"/>
        </svg>
        保存中 0/${stickerCollection.length}
    `;

    try {
        for (let i = 0; i < stickerCollection.length; i++) {
            // Update progress
            downloadAllBtn.innerHTML = `
                <svg viewBox="0 0 24 24" class="animate-spin" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 4V2A10 10 0 002 12h2a8 8 0 018-8z" fill="currentColor"/>
                </svg>
                保存中 ${i + 1}/${stickerCollection.length}
            `;

            const sticker = stickerCollection[i];
            const num = String(i + 1).padStart(2, '0');
            const fileName = `sticker-${num}.png`;

            // Convert DataURL to Blob for better browser handling
            const response = await fetch(sticker.dataUrl);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up object URL
            setTimeout(() => URL.revokeObjectURL(url), 2000);

            // Wait significantly longer to bypass some browser throttles
            await new Promise(resolve => setTimeout(resolve, 800));
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        alert('全ての画像の保存リクエストを完了しました。\n保存されていない画像がある場合は、ブラウザの「複数ファイルのダウンロード許可」を確認してください。');

    } catch (error) {
        console.error('ダウンロード処理中にエラーが発生しました:', error);
        alert(`ダウンロード中にエラーが発生しました: ${error.message}`);
    } finally {
        isDownloading = false;
        downloadAllBtn.disabled = false;
        downloadAllBtn.innerHTML = originalBtnText;
    }
}

// ===== Crop Functions =====
function startCrop() {
    if (!currentImage) return;

    cropImage.src = currentImage.src;
    cropModal.classList.remove('hidden');

    // Initialize Cropper
    if (cropper) {
        cropper.destroy();
    }

    cropper = new Cropper(cropImage, {
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        restore: false,
        modal: true,
        guides: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
    });
}

function closeCropModal() {
    cropModal.classList.add('hidden');
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
}

function applyCrop() {
    if (!cropper) return;

    // Get cropped canvas
    const croppedCanvas = cropper.getCroppedCanvas();
    if (!croppedCanvas) return;

    // Convert to image
    const newImage = new Image();
    newImage.onload = () => {
        currentImage = newImage;

        // Reset transform
        const scale = Math.min(
            STICKER_WIDTH / newImage.width,
            STICKER_HEIGHT / newImage.height
        );
        imageTransform = {
            x: STICKER_WIDTH / 2,
            y: STICKER_HEIGHT / 2,
            scale: scale,
            rotation: 0
        };

        // Update UI controls
        if (globalSize) {
            globalSize.value = Math.round(scale * 100);
            globalSizeValue.textContent = `${Math.round(scale * 100)}%`;
        }
        if (globalRotation) {
            globalRotation.value = 0;
            globalRotationValue.textContent = '0°';
        }

        updateCanvas();
        closeCropModal();
    };
    newImage.src = croppedCanvas.toDataURL('image/png');
}

// ===== Freehand Crop Functions =====
function startFreeHand() {
    if (!currentImage) return;

    freeHandModal.classList.remove('hidden');

    // Fit image to canvas container (max 60vh height, responsive width)
    const container = freeHandModal.querySelector('.crop-container');
    const maxWidth = container.clientWidth;
    const maxHeight = container.clientHeight;

    const scale = Math.min(
        maxWidth / currentImage.width,
        maxHeight / currentImage.height
    );

    freeHandCanvas.width = currentImage.width * scale;
    freeHandCanvas.height = currentImage.height * scale;

    freeHandState.scale = scale;
    freeHandState.points = [];

    resetFreeHand();
}

function resetFreeHand() {
    freeHandState.points = [];
    freeHandCtx.clearRect(0, 0, freeHandCanvas.width, freeHandCanvas.height);
    freeHandCtx.drawImage(currentImage, 0, 0, freeHandCanvas.width, freeHandCanvas.height);
}

function closeFreeHandModal() {
    freeHandModal.classList.add('hidden');
}

function handleFreeHandMouseDown(e) {
    const rect = freeHandCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    freeHandState.isDrawing = true;
    freeHandState.points = [{ x, y }];

    freeHandCtx.beginPath();
    freeHandCtx.moveTo(x, y);
    freeHandCtx.strokeStyle = '#00ff00';
    freeHandCtx.lineWidth = 3;
    freeHandCtx.lineCap = 'round';
    freeHandCtx.lineJoin = 'round';
}

function handleFreeHandMouseMove(e) {
    if (!freeHandState.isDrawing) return;

    const rect = freeHandCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    freeHandState.points.push({ x, y });
    freeHandCtx.lineTo(x, y);
    freeHandCtx.stroke();
}

function handleFreeHandMouseUp() {
    if (!freeHandState.isDrawing) return;
    freeHandState.isDrawing = false;

    // Close the path visually
    if (freeHandState.points.length > 2) {
        freeHandCtx.lineTo(freeHandState.points[0].x, freeHandState.points[0].y);
        freeHandCtx.stroke();
        freeHandCtx.closePath();

        // Show mask preview
        freeHandCtx.save();
        freeHandCtx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        freeHandCtx.fill();
        freeHandCtx.restore();
    }
}

function applyFreeHand(mode = 'keep') {
    if (freeHandState.points.length < 3) {
        alert('範囲を囲んでください');
        return;
    }

    // Create a temporary canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentImage.width;
    tempCanvas.height = currentImage.height;
    const ctx = tempCanvas.getContext('2d');

    const scale = 1 / freeHandState.scale;

    // Draw path
    ctx.beginPath();
    const firstPoint = freeHandState.points[0];
    ctx.moveTo(firstPoint.x * scale, firstPoint.y * scale);
    for (let i = 1; i < freeHandState.points.length; i++) {
        ctx.lineTo(freeHandState.points[i].x * scale, freeHandState.points[i].y * scale);
    }
    ctx.closePath();

    if (mode === 'keep') {
        // Keep inside (Crop)
        ctx.save();
        ctx.clip();
        ctx.drawImage(currentImage, 0, 0);
        ctx.restore();
    } else {
        // Remove inside (Erase)
        ctx.drawImage(currentImage, 0, 0); // Draw full image first
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'black'; // Color doesn't matter
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    // Create new image from result
    const newImage = new Image();
    newImage.onload = () => {
        currentImage = newImage;
        updateCanvas();
        closeFreeHandModal();
    };
    newImage.src = tempCanvas.toDataURL('image/png');
}

// ===== Auto Cutout Functions =====
function autoCutout() {
    if (!currentImage) return;

    // Create temp canvas to process image data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = currentImage.width;
    tempCanvas.height = currentImage.height;
    const ctx = tempCanvas.getContext('2d');
    ctx.drawImage(currentImage, 0, 0);

    const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    const width = tempCanvas.width;
    const height = tempCanvas.height;

    // Algorithm: Scanline Flood Fill from (0,0) and corners to remove background
    // Assuming background is the color at (0,0)
    const startX = 0;
    const startY = 0;
    const startPos = (startY * width + startX) * 4;
    const startColor = {
        r: data[startPos],
        g: data[startPos + 1],
        b: data[startPos + 2],
        a: data[startPos + 3]
    };

    // Tolerance for color matching (0-255)
    const tolerance = 50;

    const pixelStack = [[startX, startY]];

    // Helper to check if color matches start color
    function matchColor(pos) {
        const r = data[pos];
        const g = data[pos + 1];
        const b = data[pos + 2];
        const a = data[pos + 3];

        // If already transparent, consider it matched (already processed)
        if (a === 0) return false;

        return (
            Math.abs(r - startColor.r) <= tolerance &&
            Math.abs(g - startColor.g) <= tolerance &&
            Math.abs(b - startColor.b) <= tolerance
        );
    }

    // Helper to separate color
    function colorPixel(pos) {
        data[pos + 3] = 0; // Make transparent
    }

    while (pixelStack.length) {
        const newPos = pixelStack.pop();
        const x = newPos[0];
        let y = newPos[1];

        let pixelPos = (y * width + x) * 4;

        // Go up as long as color matches
        while (y >= 0 && matchColor(pixelPos)) {
            y--;
            pixelPos -= width * 4;
        }

        pixelPos += width * 4;
        y++;

        let reachLeft = false;
        let reachRight = false;

        // Go down and fill
        while (y < height && matchColor(pixelPos)) {
            colorPixel(pixelPos);

            // Check left
            if (x > 0) {
                if (matchColor(pixelPos - 4)) {
                    if (!reachLeft) {
                        pixelStack.push([x - 1, y]);
                        reachLeft = true;
                    }
                } else if (reachLeft) {
                    reachLeft = false;
                }
            }

            // Check right
            if (x < width - 1) {
                if (matchColor(pixelPos + 4)) {
                    if (!reachRight) {
                        pixelStack.push([x + 1, y]);
                        reachRight = true;
                    }
                } else if (reachRight) {
                    reachRight = false;
                }
            }

            y++;
            pixelPos += width * 4;
        }
    }

    // Update image
    ctx.putImageData(imageData, 0, 0);

    const processedImage = new Image();
    processedImage.onload = () => {
        if (confirm('背景を自動除去しました。\n白枠（フチドリ）を追加しますか？\n(LINEスタンプとしての視認性が向上します)')) {
            addWhiteBorder(processedImage);
        } else {
            currentImage = processedImage;
            updateCanvas();
            // Reset transform to fit
            const scale = Math.min(
                STICKER_WIDTH / processedImage.width,
                STICKER_HEIGHT / processedImage.height
            );
            imageTransform.scale = scale;
            if (globalSize) { // Update slider if exists
                globalSize.value = Math.round(scale * 100);
                globalSizeValue.textContent = `${Math.round(scale * 100)}%`;
            }
        }
    };
    processedImage.src = tempCanvas.toDataURL('image/png');
}

function addWhiteBorder(sourceImage) {
    const borderThickness = 8; // Pixel thickness of the white border

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Make canvas slightly larger to accommodate border
    canvas.width = sourceImage.width + (borderThickness * 2);
    canvas.height = sourceImage.height + (borderThickness * 2);

    // Draw white silhouette by determining non-transparent pixels
    // or simply drawing the image multiple times with offsets for a solid stroke effect
    // This "8-way offset" method produces a clean, solid outline
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#FFFFFF';

    // Optimization: Draw in a circle to create rounder corners
    const steps = 16;
    for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * 2 * Math.PI;
        const offsetX = Math.cos(angle) * borderThickness;
        const offsetY = Math.sin(angle) * borderThickness;

        ctx.drawImage(
            sourceImage,
            borderThickness + offsetX,
            borderThickness + offsetY
        );
    }

    // Fill all non-transparent pixels with white to make it a solid silhouette
    // This connects the "dots" of the previous step
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Now draw the original image on top
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(sourceImage, borderThickness, borderThickness);

    const borderedImage = new Image();
    borderedImage.onload = () => {
        currentImage = borderedImage;

        // Reset transform to fit new size
        const scale = Math.min(
            STICKER_WIDTH / borderedImage.width,
            STICKER_HEIGHT / borderedImage.height
        );
        imageTransform = {
            x: STICKER_WIDTH / 2,
            y: STICKER_HEIGHT / 2,
            scale: scale,
            rotation: 0
        };

        // Update UI controls
        if (globalSize) {
            globalSize.value = Math.round(scale * 100);
            globalSizeValue.textContent = `${Math.round(scale * 100)}%`;
        }
        if (globalRotation) {
            globalRotation.value = 0;
            globalRotationValue.textContent = '0°';
        }

        updateCanvas();
        alert('白枠付きで作成しました！');
    };
    borderedImage.src = canvas.toDataURL('image/png');
}

// ===== Initialize App =====
init();
