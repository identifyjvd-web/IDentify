// --- IndexedDB Wrapper & Offline Queue ---
const SchoolLocalDB = {
    dbName: 'SchoolSystemDB',
    version: 1,
    init: function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onupgradeneeded = (e) => {
                const idb = e.target.result;
                if (!idb.objectStoreNames.contains('store')) {
                    idb.createObjectStore('store');
                }
                if (!idb.objectStoreNames.contains('syncQueue')) {
                    idb.createObjectStore('syncQueue', { keyPath: 'id' });
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },
    get: async function(key) {
        try {
            const idb = await this.init();
            return await new Promise((resolve, reject) => {
                const tx = idb.transaction('store', 'readonly');
                const store = tx.objectStore('store');
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        } catch(e) { return null; }
    },
    set: async function(key, val) {
        try {
            const idb = await this.init();
            return await new Promise((resolve, reject) => {
                const tx = idb.transaction('store', 'readwrite');
                const store = tx.objectStore('store');
                const req = store.put(val, key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch(e) { console.warn(e); }
    },
    enqueueSync: async function(record) {
        try {
            const idb = await this.init();
            return await new Promise((resolve, reject) => {
                const tx = idb.transaction('syncQueue', 'readwrite');
                const store = tx.objectStore('syncQueue');
                const req = store.put(record);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch(e) { console.warn(e); }
    },
    dequeueSync: async function(id) {
        try {
            const idb = await this.init();
            return await new Promise((resolve, reject) => {
                const tx = idb.transaction('syncQueue', 'readwrite');
                const store = tx.objectStore('syncQueue');
                const req = store.delete(id);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        } catch(e) { console.warn(e); }
    },
    getAllSyncQueue: async function() {
        try {
            const idb = await this.init();
            return await new Promise((resolve, reject) => {
                const tx = idb.transaction('syncQueue', 'readonly');
                const store = tx.objectStore('syncQueue');
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
        } catch(e) { return []; }
    }
};

window.addEventListener('online', async () => {
    const queue = await SchoolLocalDB.getAllSyncQueue();
    if (queue.length > 0) {
        if (typeof showToast === 'function') {
            showToast('<span class="material-symbols-outlined mr-2">cloud_upload</span> Syncing ' + queue.length + ' offline records...');
        }
        for (const item of queue) {
            serverCallSilent(item.fn, [item.data], async () => {
                await SchoolLocalDB.dequeueSync(item.id);
                if (typeof db !== 'undefined' && Array.isArray(db)) {
                    const idx = db.findIndex(x => x.id === item.id);
                    if (idx > -1) {
                        db[idx]._syncStatus = 'synced';
                        if (typeof currentTab !== 'undefined' && currentTab === 'records' && typeof renderCurrentRecordsPage === 'function') {
                            renderCurrentRecordsPage();
                        }
                    }
                }
            });
        }
    }
});

function serverCall(fn, args, onSuccess, onFailure) {
    if (fn === 'loginUser') {
        const credentials = args[0] || {};
        const userId = (credentials.userId || '').toLowerCase();
        if (userId.includes('admin') && (credentials.password || '').trim() === '') {
            setTimeout(() => onSuccess({ role: 'teacher', name: 'Admin', userId: 'admin', viewMode: 'all' }), 500);
            return;
        } else if (userId.includes('teacher')) {
            setTimeout(() => onSuccess({ role: 'teacher', name: 'Teacher', userId: credentials.userId }), 500);
            return;
        } else if (userId.includes('admin')) {
            setTimeout(() => onFailure({ message: 'Admin login will be linked later.' }), 500);
            return;
        } else {
            setTimeout(() => onSuccess({ role: 'teacher', name: credentials.userId, userId: credentials.userId }), 500);
            return;
        }
    }

    if (window.db && window.firebaseAPI) {
        handleFirebaseCall(fn, args, onSuccess, onFailure);
    } else {
        if (fn === 'getRecords') setTimeout(() => onSuccess(typeof mockRecords !== 'undefined' ? mockRecords : []), 500);
        else setTimeout(() => onFailure(new Error("Firebase is not initialized or offline")), 500);
    }
}

function serverCallSilent(fn, args, onSuccess, onFailure) {
    if (!navigator.onLine && (fn === 'updateRecord' || fn === 'submitStudentData' || fn === 'addRecord' || fn === 'deleteRecord')) {
        const rec = args[0];
        if (rec && rec.id) {
            SchoolLocalDB.enqueueSync({ id: rec.id, fn: fn, data: rec, timestamp: Date.now() });
            if (onSuccess) onSuccess(rec);
            return;
        }
    }
    serverCall(fn, args, onSuccess, (err) => {
        if (fn === 'updateRecord' || fn === 'submitStudentData' || fn === 'addRecord' || fn === 'deleteRecord') {
            const rec = args[0];
            if (rec && rec.id) {
                SchoolLocalDB.enqueueSync({ id: rec.id, fn: fn, data: rec, timestamp: Date.now() });
                if (onSuccess) onSuccess(rec);
                return;
            }
        }
        if (onFailure) onFailure(err);
    });
}

async function handleFirebaseCall(fn, args, onSuccess, onFailure) {
    const { collection, addDoc, getDocs, updateDoc, setDoc, deleteDoc, doc, query, orderBy, onSnapshot, getDoc } = window.firebaseAPI;
    try {
        if (fn === 'getRecords') {
            if (window._recordsUnsubscribe) {
                window._recordsUnsubscribe();
            }
            const q = query(collection(window.db, "records"), orderBy("updatedAt", "desc"));
            window._recordsUnsubscribe = onSnapshot(q, (querySnapshot) => {
                const records = [];
                querySnapshot.forEach((doc) => { records.push({ id: doc.id, ...doc.data() }); });
                if (onSuccess) onSuccess(records);
            }, (error) => {
                console.error("Firebase Snapshot Error:", error);
            });
        } else if (fn === 'submitStudentData' || fn === 'addRecord') {
            const data = args[0];
            data.updatedAt = Date.now();
            const cleanData = JSON.parse(JSON.stringify(data));
            if (cleanData.id && !String(cleanData.id).startsWith('draft_') && !String(cleanData.id).startsWith('TEMP_')) {
                const docRef = doc(window.db, "records", String(cleanData.id));
                await setDoc(docRef, cleanData);
                if (onSuccess) onSuccess(data);
            } else {
                const docRef = await addDoc(collection(window.db, "records"), cleanData);
                data.id = docRef.id;
                if (onSuccess) onSuccess(data);
            }
        } else if (fn === 'updateStudentData' || fn === 'updateRecord') {
            const data = args[0];
            data.updatedAt = Date.now();
            const cleanData = JSON.parse(JSON.stringify(data));
            const docRef = doc(window.db, "records", String(cleanData.id));
            await setDoc(docRef, cleanData, { merge: true });
            
            // Delete old document from Firebase if the ID changed (e.g. from draft_ to serial-numbered ID)
            if (data.oldId && String(data.oldId) !== String(data.id)) {
                try {
                    const oldDocRef = doc(window.db, "records", String(data.oldId));
                    await deleteDoc(oldDocRef);
                    console.log("Deleted old draft document from Firebase:", data.oldId);
                } catch(e) {
                    console.warn("Failed to delete old draft document from Firebase:", e);
                }
            }
            
            if (onSuccess) onSuccess(data);
        } else if (fn === 'permanentDelete' || fn === 'deleteRecord') {
            const id = args[0];
            const docRef = doc(window.db, "records", String(id));
            await deleteDoc(docRef);
            if (onSuccess) onSuccess(true);
        } else if (fn === 'deleteAllRecords') {
            const q = query(collection(window.db, "records"));
            const querySnapshot = await getDocs(q);
            const docs = querySnapshot.docs;
            const chunkSize = 100;
            for (let i = 0; i < docs.length; i += chunkSize) {
                const chunk = docs.slice(i, i + chunkSize);
                await Promise.all(chunk.map(d => deleteDoc(d.ref)));
            }

            // Also clear activityLogs
            try {
                const logsQ = query(collection(window.db, "activityLogs"));
                const logsSnapshot = await getDocs(logsQ);
                const logDocs = logsSnapshot.docs;
                for (let i = 0; i < logDocs.length; i += chunkSize) {
                    const chunk = logDocs.slice(i, i + chunkSize);
                    await Promise.all(chunk.map(d => deleteDoc(d.ref)));
                }
            } catch (e) {
                console.warn('Could not clear activityLogs', e);
            }

            if (onSuccess) onSuccess(true);
        } else if (fn === 'saveFormFields') {
            const data = args[0];
            const docRef = doc(window.db, "system", "formBuilderConfig");
            await setDoc(docRef, data);
            if (onSuccess) onSuccess();
        } else if (fn === 'getFormFields') {
            const docRef = doc(window.db, "system", "formBuilderConfig");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                if (onSuccess) onSuccess(docSnap.data());
            } else {
                if (onSuccess) onSuccess(null);
            }
        } else if (fn === 'generateId') {
            const { runTransaction } = window.firebaseAPI;
            if (!runTransaction) throw new Error("runTransaction missing");
            const localMaxSn = args[0] || 0;
            const counterRef = doc(window.db, "config", "snCounter");
            try {
                const newSn = await runTransaction(window.db, async (transaction) => {
                    const sfDoc = await transaction.get(counterRef);
                    let currentSn = 0;
                    if (sfDoc.exists()) {
                        currentSn = sfDoc.data().value || 0;
                        if (currentSn > 1000000000) currentSn = 0;
                    }
                    const nextSn = Math.max(currentSn, localMaxSn) + 1;
                    transaction.set(counterRef, { value: nextSn }, { merge: true });
                    return nextSn;
                });
                if (onSuccess) onSuccess(newSn);
            } catch (e) {
                if (onFailure) onFailure(e);
            }
        } else if (fn === 'uploadRecordDocument') {
            const { ref, uploadString, getDownloadURL } = window.firebaseAPI;
            if (!window.storage) throw new Error("Firebase Storage is not initialized.");
            const payload = args[0];
            const storageRef = ref(window.storage, `documents/${payload.fileName}`);
            await uploadString(storageRef, payload.base64Data, 'base64', {
                contentType: payload.mimeType
            });
            const downloadURL = await getDownloadURL(storageRef);
            if (onSuccess) {
                onSuccess({
                    fileId: payload.fileName,
                    url: downloadURL,
                    previewUrl: downloadURL,
                    mimeType: payload.mimeType,
                    size: 0
                });
            }
        } else {
            if (onSuccess) onSuccess(true);
        }
    } catch (error) {
        console.error("Firebase Error:", error);
        if (onFailure) onFailure(error);
    }
}
