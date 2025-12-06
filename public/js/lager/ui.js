// public/js/lager/ui.js

// Toast-Notification System
window.showToast = (msg, type = 'info') => {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = msg;
    
    // Inline Styles als Fallback, falls CSS fehlt
    toast.style.padding = '12px 20px';
    toast.style.margin = '10px';
    toast.style.borderRadius = '5px';
    toast.style.color = '#fff';
    toast.style.fontFamily = 'Segoe UI, sans-serif';
    toast.style.minWidth = '250px';
    toast.style.zIndex = '10000';
    
    // Farben nach Typ
    if (type === 'error') toast.style.background = '#e74c3c'; // Rot
    else if (type === 'success') toast.style.background = '#2ecc71'; // Grün
    else toast.style.background = '#3498db'; // Blau

    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    toast.style.transform = 'translateY(-10px)';

    container.appendChild(toast);
    
    // Animation Start
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    // Auto-Remove nach 3 Sekunden
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
};

function createToastContainer() {
    const div = document.createElement('div');
    div.id = 'toast-container';
    div.style.position = 'fixed';
    div.style.top = '20px';
    div.style.right = '20px';
    div.style.zIndex = '9999';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.alignItems = 'flex-end';
    document.body.appendChild(div);
    return div;
}

// Socket Events verbinden (falls Socket geladen ist)
document.addEventListener("DOMContentLoaded", () => {
    if(window.socket) {
        // Fehler vom Server direkt anzeigen
        window.socket.on('error-msg', (msg) => window.showToast(msg, 'error'));
        
        // Erfolgsmeldungen filtern und anzeigen
        window.socket.on('server-log', (data) => {
            if(data.type === 'success') window.showToast(data.msg, 'success');
        });
        
        console.log("UI: Toast-System mit Socket verbunden.");
    }
});