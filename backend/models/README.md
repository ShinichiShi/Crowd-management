Place trained model artifacts in this folder:

- csrnet_model.pth
- lstm_model.pth

Optional normalization metadata file for LSTM:
- lstm_scaler.json

Example lstm_scaler.json (min-max):
{
  "method": "minmax",
  "min": 0,
  "max": 50000
}

Example lstm_scaler.json (z-score):
{
  "method": "zscore",
  "mean": 12000,
  "std": 4000
}

## Installing new weights

Train with `kaggle_model/crowd-counting-optimised-v2.ipynb`, download the notebook output, then:

```bash
python backend/scripts/install_models.py <folder-or-zip> --figures
```

This backs up the current files, installs the new ones, verifies they load with the backend code and copies the result CSVs to `results/`.
