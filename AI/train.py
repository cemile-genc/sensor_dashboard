import pandas as pd, numpy as np, os, json
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error
from joblib import dump

CSV_PATH="data.csv"; TARGET="do_mg_L"; LAGS=6

def smart_read_csv(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        head=f.read(2048)
    sep=";" if head.count(";")>head.count(",") else ","
    df=pd.read_csv(path, sep=sep, engine="python", encoding="utf-8", encoding_errors="ignore", on_bad_lines="skip")
    if "timestamp" in df.columns:
        df["timestamp"]=pd.to_datetime(df["timestamp"], errors="coerce")
    for col in ["do_mg_L","voltage","ph","temperature"]:
        if col in df.columns:
            df[col]=(df[col].astype(str).str.replace(",", ".", regex=False)
                                   .str.replace("\u202f","", regex=False))
            df[col]=pd.to_numeric(df[col], errors="coerce")
    df=df.dropna(subset=["timestamp", TARGET]).sort_values("timestamp")
    return df

def make_supervised(df, col, lags):
    X=pd.DataFrame({f"{col}_lag{i}":df[col].shift(i) for i in range(1,lags+1)})
    y=df[col]
    data=pd.concat([X,y],axis=1).dropna()
    return data.drop(columns=[col]).values, data[col].values

def time_split(X,y,ratio=0.8):
    n=len(X); k=int(n*ratio)
    return X[:k],X[k:],y[:k],y[k:]

df=smart_read_csv(CSV_PATH)
X,y=make_supervised(df, TARGET, LAGS)
Xtr,Xte,ytr,yte=time_split(X,y,0.8)

pipe=Pipeline([("scaler",StandardScaler()),("ridge",Ridge(alpha=1.0))])
pipe.fit(Xtr,ytr)
mae=float(mean_absolute_error(yte, pipe.predict(Xte)))
print({"MAE":mae,"n_train":len(Xtr),"n_test":len(Xte),"lags":LAGS})

os.makedirs("models", exist_ok=True)
dump(pipe, "models/do_mg_L.joblib")
with open("models/meta.json","w",encoding="utf-8") as f:
    json.dump({"do_mg_L":{"MAE":mae,"lags":LAGS}}, f, indent=2, ensure_ascii=False)
