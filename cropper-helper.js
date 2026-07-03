let cropperInstance = null;
let currentlyCroppingCustomIdx = null; // 1-indexed (1 to 5) or null for student photo

function openCropModal() {
    currentlyCroppingCustomIdx = null;
    const img = document.getElementById('blank-photo-preview-img');
    if (!img || !img.src) return;

    const modal = document.getElementById('crop-modal');
    const cropImg = document.getElementById('crop-modal-img');

    cropImg.src = img.src;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const pMeta = (typeof fb_standard_meta !== 'undefined' ? fb_standard_meta['photo'] : null) || (typeof schoolConfig !== 'undefined' && schoolConfig.formMeta && schoolConfig.formMeta['photo']) || {};
    const cWidth = pMeta.width || 600;
    const cHeight = pMeta.height || 800;

    if (cropperInstance) { cropperInstance.destroy(); }
    cropperInstance = new Cropper(cropImg, {
        aspectRatio: cWidth / cHeight,
        viewMode: 1,
        autoCropArea: 1,
    });
}

function openCustomCropModal(idx) {
    currentlyCroppingCustomIdx = idx;
    const img = document.getElementById(`blank-custom-img-preview-${idx}`);
    if (!img || !img.src) return;

    const modal = document.getElementById('crop-modal');
    const cropImg = document.getElementById('crop-modal-img');

    cropImg.src = img.src;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const field = (typeof fb_fields !== 'undefined' && fb_fields[idx - 1]) || {};
    const imgWidth = field.width || 600;
    const imgHeight = field.height || 800;

    if (cropperInstance) { cropperInstance.destroy(); }
    cropperInstance = new Cropper(cropImg, {
        aspectRatio: imgWidth / imgHeight,
        viewMode: 1,
        autoCropArea: 1,
    });
}

function closeCropModal() {
    const modal = document.getElementById('crop-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    currentlyCroppingCustomIdx = null;
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
}

function applyCrop() {
    if (!cropperInstance) return;
    
    if (currentlyCroppingCustomIdx !== null) {
        const idx = currentlyCroppingCustomIdx;
        const field = (typeof fb_fields !== 'undefined' && fb_fields[idx - 1]) || {};
        const imgWidth = field.width || 600;
        const imgHeight = field.height || 800;
        const canvas = cropperInstance.getCroppedCanvas({
            width: imgWidth,
            height: imgHeight,
        });
        if (canvas) {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            if (typeof syncBlankField === 'function') {
                syncBlankField(`in-customField${idx}`, dataUrl);
            }
            
            const previewImg = document.getElementById(`blank-custom-img-preview-${idx}`);
            const placeholder = document.getElementById(`blank-custom-img-placeholder-${idx}`);
            const container = document.getElementById(`blank-custom-img-container-${idx}`);
            
            if (previewImg) {
                previewImg.src = dataUrl;
                previewImg.classList.remove('hidden');
            }
            if (placeholder) {
                placeholder.classList.add('hidden');
            }
            
            let cropBtn = document.getElementById(`blank-custom-img-crop-${idx}`);
            let removeBtn = document.getElementById(`blank-custom-img-remove-${idx}`);
            
            if (!cropBtn && container) {
                cropBtn = document.createElement('button');
                cropBtn.type = 'button';
                cropBtn.id = `blank-custom-img-crop-${idx}`;
                cropBtn.className = 'absolute bottom-1 left-1 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform hover:bg-blue-600';
                cropBtn.onclick = () => openCustomCropModal(idx);
                cropBtn.title = 'Crop Photo';
                cropBtn.innerHTML = '<i class="fa-solid fa-crop-simple text-[11px]"></i>';
                container.appendChild(cropBtn);
            } else if (cropBtn) {
                cropBtn.classList.remove('hidden');
            }

            if (!removeBtn && container) {
                removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.id = `blank-custom-img-remove-${idx}`;
                removeBtn.className = 'absolute bottom-1 right-1 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform hover:bg-rose-600';
                removeBtn.onclick = () => {
                    if (typeof removeCustomPhoto === 'function') {
                        removeCustomPhoto(idx);
                    }
                };
                removeBtn.title = 'Delete Photo';
                removeBtn.innerHTML = '<i class="fa-solid fa-xmark text-[12px]"></i>';
                container.appendChild(removeBtn);
            } else if (removeBtn) {
                removeBtn.classList.remove('hidden');
            }
            if (typeof renderCurrentRecordsPage === 'function') renderCurrentRecordsPage();
        }
    } else {
        const pMeta = (typeof fb_standard_meta !== 'undefined' ? fb_standard_meta['photo'] : null) || (typeof schoolConfig !== 'undefined' && schoolConfig.formMeta && schoolConfig.formMeta['photo']) || {};
        const cWidth = pMeta.width || 600;
        const cHeight = pMeta.height || 800;
        const canvas = cropperInstance.getCroppedCanvas({
            width: cWidth,
            height: cHeight,
        });
        if (canvas) {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            if (typeof photoData !== 'undefined') {
                photoData = dataUrl;
            }
            if (typeof showPhotoPreview === 'function') {
                showPhotoPreview(dataUrl);
            }
            if (typeof queueServerDraftSync === 'function') queueServerDraftSync();
            if (typeof renderCurrentRecordsPage === 'function') renderCurrentRecordsPage();
        }
    }
    closeCropModal();
}
