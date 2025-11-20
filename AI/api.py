# ai/api.py
from flask import Flask, request, jsonify
from joblib import load
from flask_cors import CORS
import numpy as np
import os

# ---- Ayarlar ----
APP_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(APP_DIR, "models", "do_mg_L.joblib")  # eğittiğin model dosyası
MODEL_LAGS = 6          # modelin eğitimde kullandığı lag sayısı
Y_MIN, Y_MAX = 0.0, 20.0  # DO için mantıklı aralık (istersen 0–14 yap)

# ---- Yükleme ----
model = load(MODEL_PATH)

# ---- Flask ----
app = Flask(__name__)
CORS(app)  # React'tan istek gelsin diye

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/meta")
def meta():
    # Frontend burada modelin kaç lag ile eğitildiğini öğrenir
    return {"lags": MODEL_LAGS, "y_min": Y_MIN, "y_max": Y_MAX}

@app.post("/predict_do")
def predict_do():
    data = request.get_json(force=True)
    series = data.get("series", [])  # en eski -> en yeni
    lags   = data.get("lags", MODEL_LAGS)

    if len(series) < lags:
        return jsonify({"error": f"need at least {lags} values"}), 400

    # Son 'lags' değeri al, modele uygun şekle getir
    x = np.array(series[-lags:], dtype=float).reshape(1, -1)
    yhat = float(model.predict(x)[0])

    # Güvenli aralığa kırp
    yhat_clipped = float(np.clip(yhat, Y_MIN, Y_MAX))
    was_clipped  = (yhat_clipped != yhat)

    return jsonify({"yhat": yhat_clipped, "clipped": was_clipped, "lags": int(lags)})

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)
