import { createContext, useContext, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  function showToast(message, type = "success") {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }

  function askConfirm(message) {
    return new Promise((resolve) => {
      setConfirmState({ message, resolve });
    });
  }

  function handleConfirmClose(result) {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  }

  return (
    <ToastContext.Provider value={{ showToast, askConfirm }}>
      {children}

      {/* Floating Toast Messages */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.type === "error" ? "⚠️" : "✅"}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Custom In-App Confirmation Modal (no browser localhost popups) */}
      {confirmState && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3 style={{ marginBottom: 8 }}>Please Confirm</h3>
            <p style={{ color: "var(--muted)", marginBottom: 18 }}>{confirmState.message}</p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleConfirmClose(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => handleConfirmClose(true)}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
