"""Generates the architecture diagrams used in README.md  ->  docs/images/*.png
Run:  python docs/make_diagrams.py   (needs matplotlib, numpy, scipy, opencv-python; density figure needs the ShanghaiTech data)
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle

OUT = os.path.join(os.path.dirname(__file__), "images")
os.makedirs(OUT, exist_ok=True)
C = dict(client="#DBEAFE", api="#DCFCE7", model="#FEF3C7", demo="#FDE2E2", data="#EDE9FE", edge="#334155", ink="#0F172A",
         conv="#93C5FD", pool="#FCA5A5", dil="#86EFAC", out="#FDE68A", gray="#E2E8F0")


def canvas(w, h, title, xl=None, yl=None):
    fig, ax = plt.subplots(figsize=(w, h)); ax.set_xlim(0, xl or w * 10); ax.set_ylim(0, yl or h * 10); ax.axis("off")
    ax.set_title(title, fontsize=16, fontweight="bold", color=C["ink"], pad=12)
    return fig, ax


def box(ax, x, y, w, h, text, fc="#fff", fs=9.5, bold=False, ec=None, lw=1.4, ls="-", ha="center"):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.25,rounding_size=1.2", fc=fc, ec=ec or C["edge"], lw=lw, ls=ls))
    tx = x + w / 2 if ha == "center" else x + 1.2
    ax.text(tx, y + h / 2, text, ha=ha, va="center", fontsize=fs, color=C["ink"], fontweight="bold" if bold else "normal", linespacing=1.35)


def arrow(ax, p, q, text="", color=None, ls="-", fs=8.5, rad=0.0, off=(0, 1.2), lw=1.6):
    ax.add_patch(FancyArrowPatch(p, q, arrowstyle="-|>", mutation_scale=14, lw=lw, color=color or C["edge"], ls=ls, connectionstyle=f"arc3,rad={rad}"))
    if text:
        ax.text((p[0] + q[0]) / 2 + off[0], (p[1] + q[1]) / 2 + off[1], text, ha="center", va="bottom", fontsize=fs, color=color or C["edge"], style="italic")


def group(ax, x, y, w, h, label, fc):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.3,rounding_size=2", fc=fc, ec=C["edge"], lw=1.2, alpha=.35))
    ax.text(x + 1.5, y + h - 2.2, label, fontsize=11, fontweight="bold", color=C["ink"], va="center")


# ------------------------------------------------------------------ 1. system architecture
def system():
    fig, ax = canvas(17, 10.4, "System architecture")
    group(ax, 2, 6, 40, 92, "CLIENT - Next.js :3000", C["client"])
    for i, (t, sub) in enumerate([("Dashboard", "KPIs, 24h trend, photo estimator"), ("Alerts", "severity feed + counters"), ("Analytics", "history, festivals, accuracy"), ("Home / About / Insights", "static pages")]):
        box(ax, 5, 82 - i * 13, 34, 10, f"{t}\n{sub}", C["client"], 9)
    box(ax, 5, 24, 34, 12, "lib/api.ts + useApi()\nlive call; on failure re-send\nto /demo/<same path>", "#BFDBFE", 9, True)
    box(ax, 5, 9, 34, 9, "SourceBadge\nLive / Demo backup / Offline", "#BFDBFE", 9)

    group(ax, 52, 6, 62, 92, "BACKEND - FastAPI + PyTorch :8000", C["api"])
    box(ax, 55, 84, 27, 10, "POST /predict-count\nimage -> people", C["api"], 9)
    box(ax, 85, 84, 26, 10, "POST /predict-future\n24 counts -> next hour", C["api"], 9)
    box(ax, 55, 71, 27, 10, "POST /risk\ncounts -> score + level", C["api"], 9)
    box(ax, 85, 71, 26, 10, "GET /dashboard-data\n/analytics-data /alerts-data", C["api"], 8.5)
    box(ax, 55, 58, 56, 9, "Fallback guard: model missing / inference error -> demo logic\n(response header X-Data-Source: demo-fallback)", "#FFE4E6", 9, ec="#BE123C")
    box(ax, 55, 44, 27, 11, "ModelRegistry\nloads once at startup\ncuda if available else cpu", C["model"], 9, True)
    box(ax, 85, 44, 26, 11, "preprocessing.py\nImageNet norm, min-max\nscaler, hour/weekday", C["model"], 9)
    box(ax, 55, 30, 27, 10, "CSRNet\n11.5M params", C["model"], 9.5, True)
    box(ax, 85, 30, 26, 10, "CrowdLSTM\n51K params", C["model"], 9.5, True)
    box(ax, 55, 9, 56, 16, "/demo/*  (same paths, no model files needed)\ndeterministic image-energy count, seasonal forecast\nsame risk formula, mock dashboard / analytics / alerts", C["demo"], 9, ec="#BE123C", ls="--")

    group(ax, 122, 6, 36, 92, "ARTIFACTS (from Kaggle)", C["data"])
    for i, t in enumerate(["csrnet_model.pth\nraw state_dict, strict load", "lstm_model.pth\nstate_dict + config + scaler", "lstm_scaler.json\nmin-max fallback"]):
        box(ax, 125, 78 - i * 15, 30, 11, t, C["data"], 9)
    box(ax, 125, 20, 30, 20, "Trained in the notebook\nShanghaiTech A+B\nCSRNet, then LSTM\non CSRNet counts", "#DDD6FE", 9)

    arrow(ax, (42, 60), (52, 60), "HTTP / JSON", off=(0, 1.5))
    arrow(ax, (42, 15), (52, 15), "if live fails", "#BE123C", "--", off=(0, 1.5))
    arrow(ax, (68, 44), (68, 40)); arrow(ax, (98, 44), (98, 40))
    arrow(ax, (122, 50), (114, 50), "loaded once\nat startup", off=(0, 2))
    fig.savefig(f"{OUT}/system_architecture.png", dpi=150, bbox_inches="tight"); plt.close(fig)


# ------------------------------------------------------------------ 2. CSRNet
def csrnet():
    fig, ax = canvas(19, 9.6, "CSRNet - layer by layer (11,543,873 parameters)", xl=195, yl=100)
    ax.text(1, 70, "input\n3xHxW", fontsize=8.5, va="center")
    stages = [("conv1", "2 x conv3x3, 64", 64, "H x W", C["conv"]), ("pool", "maxpool 2x2", 64, "H/2 x W/2", C["pool"]),
              ("conv2", "2 x conv3x3, 128", 128, "H/2", C["conv"]), ("pool", "maxpool 2x2", 128, "H/4 x W/4", C["pool"]),
              ("conv3", "3 x conv3x3, 256", 256, "H/4", C["conv"]), ("pool", "maxpool 2x2", 256, "H/8 x W/8", C["pool"]),
              ("conv4", "3 x conv3x3, 512", 512, "H/8", C["conv"])]
    x = 16
    for name, txt, ch, size, col in stages:
        h = 6 + ch / 512 * 30; w = 7
        ax.add_patch(Rectangle((x, 52 - h / 2), w, h, fc=col, ec=C["edge"], lw=1.2))
        ax.text(x + w / 2, 52 + h / 2 + 2.5, name, ha="center", fontsize=9, fontweight="bold")
        ax.text(x + w / 2, 52 - h / 2 - 2.5, f"{txt}\n{ch}ch | {size}", ha="center", va="top", fontsize=7)
        x += 11.5
    ax.text(14, 90, "FRONTEND = VGG16 layers 0-22 (ImageNet pretrained)\n7,635,264 params | keys frontend.*", fontsize=10, fontweight="bold", color="#1D4ED8", va="top")
    ax.add_patch(Rectangle((13, 22), 89, 70, fc="none", ec="#1D4ED8", lw=1.4, ls="--"))
    x = 110
    ax.text(107, 90, "BACKEND = dilated convs (rate 2)\n3,908,609 params | keys backend.*", fontsize=10, fontweight="bold", color="#15803D", va="top")
    ax.add_patch(Rectangle((106, 22), 56, 70, fc="none", ec="#15803D", lw=1.4, ls="--"))
    for txt, ch in [("dil conv3x3, 512", 512), ("dil conv3x3, 256", 256), ("dil conv3x3, 128", 128), ("dil conv3x3, 64", 64)]:
        h = 6 + ch / 512 * 30
        ax.add_patch(Rectangle((x, 52 - h / 2), 6, h, fc=C["dil"], ec=C["edge"], lw=1.2))
        ax.text(x + 3, 52 - h / 2 - 2.5, f"{txt}\nReLU | H/8", ha="center", va="top", fontsize=7)
        x += 12
    ax.add_patch(Rectangle((x, 46), 4, 12, fc=C["out"], ec=C["edge"], lw=1.2)); ax.text(x + 2, 43, "conv1x1\n64 -> 1", ha="center", va="top", fontsize=7)
    arrow(ax, (166, 52), (171, 52))
    box(ax, 172, 40, 20, 24, "density map\n1 x H/8 x W/8\n\nsum of all\npixels =\npeople count", "#FEF9C3", 8.5, True)
    ax.text(2, 10, "Every ground-truth head is a Gaussian that sums to 1, so summing the predicted map gives the count.  Training loss = MSE(density) + 0.01 x |sum(pred) - sum(gt)|.\n"
                   "The output is 1/8 resolution, so H and W are cropped to multiples of 8.", fontsize=9, color=C["ink"])
    fig.savefig(f"{OUT}/csrnet_architecture.png", dpi=150, bbox_inches="tight"); plt.close(fig)


# ------------------------------------------------------------------ 3. LSTM
def lstm():
    fig, ax = canvas(17, 8.2, "Forecaster - CrowdLSTM (next-hour count)")
    ax.text(2, 76, "Input window: last 24 hourly CSRNet counts", fontsize=11, fontweight="bold")
    for i in range(24):
        h = 4 + 10 * (0.5 + 0.5 * np.sin(i / 3.5))
        ax.add_patch(Rectangle((3 + i * 1.75, 60), 1.4, h, fc="#93C5FD", ec=C["edge"], lw=.6))
    ax.text(3, 56, "channel 0: count, min-max scaled (lstm_scaler.json)", fontsize=8.5)
    for i, t in enumerate(["sin(hour)", "cos(hour)", "sin(weekday)", "cos(weekday)"]):
        ax.add_patch(Rectangle((3, 47 - i * 3.6), 42, 2.6, fc="#DDD6FE", ec=C["edge"], lw=.6)); ax.text(24, 48.3 - i * 3.6, t, ha="center", va="center", fontsize=7.5)
    ax.text(3, 26, "channels 1-4: optional time features (only if the selected variant uses them)\n-> input tensor (1, 24, 1) or (1, 24, 5)", fontsize=8.5, va="top")
    box(ax, 62, 44, 30, 26, "LSTM layer 1\nhidden 64 (dropout 0.1)\n\nLSTM layer 2\nhidden 64", C["model"], 10, True)
    arrow(ax, (47, 57), (62, 57), "24 steps", off=(0, 1))
    box(ax, 100, 51, 22, 12, "h(t=24)\nlast hidden state\n64-d", "#FEF9C3", 9)
    arrow(ax, (92, 57), (100, 57))
    box(ax, 129, 51, 22, 12, "Linear (fc)\n64 -> 1", C["model"], 10, True)
    arrow(ax, (122, 57), (129, 57))
    box(ax, 129, 30, 22, 12, "+ latest count\n(residual variant)", "#FFE4E6", 9, ec="#BE123C", ls="--")
    arrow(ax, (140, 51), (140, 42))
    box(ax, 129, 9, 22, 12, "denormalise ->\nnext-hour\npeople count", "#DCFCE7", 9.5, True)
    arrow(ax, (140, 30), (140, 21))
    arrow(ax, (47, 36), (129, 36), "skip connection: latest count x[:, -1, 0] (residual variant only)", "#BE123C", "--", off=(-8, 1.2))
    ax.text(3, 10, "5 variants are trained automatically (univariate | +residual | +time features | +both | +peak-weighted loss);\nthe one with the lowest VALIDATION loss is exported.  Params: 50,497 (1 channel) / 51,521 (5 channels).", fontsize=9)
    fig.savefig(f"{OUT}/lstm_architecture.png", dpi=150, bbox_inches="tight"); plt.close(fig)


# ------------------------------------------------------------------ 4. training pipeline
def pipeline():
    fig, ax = canvas(18, 8.8, "End-to-end pipeline: data -> CSRNet -> stream -> LSTM -> API")
    steps = [
        (2, 62, "1  DATA", "ShanghaiTech Part A (dense)\n+ Part B (street)\nimages + head points (.mat)", C["data"]),
        (40, 62, "2  DENSITY MAPS", "points -> Gaussian on 1/8 grid\nB: sigma 15  |  A: adaptive\nsum = count", C["data"]),
        (78, 62, "3  TRAIN CSRNet", "VGG16 ImageNet init | random crops\nflip + colour jitter | AMP\nEMA weights | cosine LR", C["model"]),
        (116, 62, "4  EVALUATE", "held-out test images\nMAE  RMSE  MAPE  R2\nflip test-time augmentation", C["model"]),
        (116, 30, "5  SIMULATED STREAM", "365 d hourly pattern (peaks,\nweekends, festivals). Each hour a\ntest image -> CSRNet count", C["api"]),
        (78, 30, "6  TRAIN LSTM", "24 CSRNet counts -> next true\ncount. 5 variants, best on val.\nchronological 70/15/15", C["api"]),
        (40, 30, "7  COMPARE", "CSRNet only vs CSRNet + LSTM\nbaselines: moving avg, seasonal\nrisk + surge-onset warning", C["client"]),
        (2, 30, "8  EXPORT -> BACKEND", "csrnet_model.pth | lstm_model.pth\nlstm_scaler.json | figures | CSVs\nbackend_models/ folder", C["demo"]),
    ]
    for x, y, t, d, col in steps:
        box(ax, x, y, 34, 24, f"{t}\n\n{d}", col, 9, False)
    for a, b in [((36, 74), (40, 74)), ((74, 74), (78, 74)), ((112, 74), (116, 74)), ((133, 62), (133, 54)), ((116, 42), (112, 42)), ((78, 42), (74, 42)), ((40, 42), (36, 42))]:
        arrow(ax, a, b)
    arrow(ax, (36 + 0, 74), (40, 74))
    box(ax, 2, 4, 150, 16, "Serving (see system architecture):  Next.js  ->  FastAPI  ->  ModelRegistry  ->  CSRNet / LSTM     |     on any failure: reroute to /demo\n"
                           "Train/serve contract:  ImageNet mean/std  |  count = sum(output)  |  plain state_dict keys (no 'module.')  |  same min-max scaler  |  same time features", "#F1F5F9", 9.5)
    fig.savefig(f"{OUT}/training_pipeline.png", dpi=150, bbox_inches="tight"); plt.close(fig)


# ------------------------------------------------------------------ 5. demo fallback flow
def fallback():
    fig, ax = canvas(18, 7.2, "Backup routing: live models with /demo reroute", xl=180)
    box(ax, 2, 50, 26, 14, "Browser request\n(e.g. Estimate photo)", C["client"], 10, True)
    box(ax, 40, 50, 26, 14, "api.ts: try\nPOST /predict-count", C["client"], 10)
    box(ax, 78, 50, 30, 14, "FastAPI live route\nCSRNet inference", C["api"], 10, True)
    box(ax, 118, 50, 26, 14, "Response\nX-Data-Source: live", "#BBF7D0", 10, True)
    box(ax, 152, 50, 26, 14, "UI badge\nLive / Demo backup /\nOffline sample data", C["client"], 9)
    arrow(ax, (28, 57), (40, 57)); arrow(ax, (66, 57), (78, 57)); arrow(ax, (108, 57), (118, 57), "ok", "#15803D")
    arrow(ax, (144, 57), (152, 57), "", off=(0, 1))
    box(ax, 78, 24, 30, 14, "Server-side guard\nmodel missing or error\n(DEMO_FALLBACK=1)", "#FFE4E6", 9.5, ec="#BE123C")
    arrow(ax, (93, 50), (93, 38), "fails", "#BE123C")
    box(ax, 118, 24, 26, 14, "demo logic\nX-Data-Source:\ndemo-fallback", "#FECACA", 9.5, True, ec="#BE123C")
    arrow(ax, (108, 31), (118, 31), "", "#BE123C", "--")
    arrow(ax, (131, 38), (131, 50), "returned", "#BE123C", "--", off=(6, 0))
    box(ax, 40, 24, 30, 14, "Network down or 5xx?\nre-send to\n/demo/predict-count", "#FEF3C7", 9.5, ec="#B45309")
    arrow(ax, (53, 50), (53, 38), "unreachable", "#B45309")
    box(ax, 40, 4, 30, 12, "/demo route (no models)\nX-Data-Source: demo", "#FDE2E2", 9.5, True, ec="#BE123C")
    arrow(ax, (55, 24), (55, 16), "", "#B45309")
    ax.text(78, 8, "4xx errors (bad input) are NOT rerouted.\nIf even /demo is unreachable, the page keeps its built-in sample data.", fontsize=9)
    fig.savefig(f"{OUT}/demo_fallback.png", dpi=150, bbox_inches="tight"); plt.close(fig)


# ------------------------------------------------------------------ 6. density-map illustration (real data)
def density():
    import cv2
    from scipy.io import loadmat
    from scipy.ndimage import gaussian_filter
    root = os.environ.get("CROWD_DATA", os.path.join(os.path.dirname(__file__), "..", "kaggle_model", "archive", "ShanghaiTech", "part_B", "train_data"))
    name = "IMG_1"
    img = cv2.cvtColor(cv2.imread(f"{root}/images/{name}.jpg"), cv2.COLOR_BGR2RGB)
    pts = loadmat(f"{root}/ground-truth/GT_{name}.mat")["image_info"][0][0][0][0][0]
    h8, w8 = img.shape[0] // 8, img.shape[1] // 8
    g = np.zeros((h8, w8), np.float32)
    np.add.at(g, (np.clip((pts[:, 1] // 8).astype(int), 0, h8 - 1), np.clip((pts[:, 0] // 8).astype(int), 0, w8 - 1)), 1.0)
    d = gaussian_filter(g, 15 / 8, mode="constant")
    fig, ax = plt.subplots(1, 3, figsize=(17, 4.6))
    ax[0].imshow(img); ax[0].scatter(pts[:, 0], pts[:, 1], s=6, c="red"); ax[0].set_title(f"1. annotated heads ({len(pts)} points)")
    ax[1].imshow(g, cmap="gray_r"); ax[1].set_title("2. points binned on the 1/8 grid")
    im = ax[2].imshow(d, cmap="jet"); ax[2].set_title(f"3. Gaussian-blurred density map (sum = {d.sum():.1f})")
    for a in ax: a.axis("off")
    fig.colorbar(im, ax=ax[2], fraction=.04)
    fig.suptitle("Ground truth for CSRNet: a point annotation becomes a density map whose sum is the head count", fontsize=13, fontweight="bold")
    fig.savefig(f"{OUT}/density_map_generation.png", dpi=140, bbox_inches="tight"); plt.close(fig)


# ------------------------------------------------------------------ 7. camera integration
def cameras():
    fig, ax = canvas(18, 8.6, "Temple management and camera-feed integration", xl=180, yl=86)
    group(ax, 2, 44, 34, 38, "CAMERAS", C["client"])
    box(ax, 5, 62, 28, 9, "IP camera / NVR\nHTTP snapshot, MJPEG, RTSP", C["client"], 8.5)
    box(ax, 5, 50, 28, 9, "Edge box / phone\n(behind NAT, no inbound port)", C["client"], 8.5)
    group(ax, 46, 44, 62, 38, "BACKEND INGESTION", C["api"])
    box(ax, 49, 62, 26, 9, "Poller (asyncio task)\nevery camera interval\ngrab_frame(): urllib / OpenCV", C["api"], 8.5)
    box(ax, 49, 50, 26, 9, "POST /ingest/<api_key>\nper-camera secret in the URL", C["api"], 8.5)
    box(ax, 80, 56, 25, 12, "analyze_image_bytes()\nCSRNet (+flip TTA) -> count,\ndensity map, level", C["model"], 8.5, True)
    arrow(ax, (33, 66), (49, 66), "pull", off=(0, 1.2)); arrow(ax, (33, 54), (49, 54), "push", off=(0, 1.2))
    arrow(ax, (75, 66), (80, 63)); arrow(ax, (75, 54), (80, 59))
    group(ax, 118, 44, 60, 38, "STORAGE (SQLite, backend/data)", C["data"])
    box(ax, 121, 62, 26, 9, "temples\nname, capacity, warn/crit,\ncontact, location", C["data"], 8.5)
    box(ax, 150, 62, 25, 9, "cameras\ntype, url (masked), zone,\ninterval, api_key", C["data"], 8.5)
    box(ax, 121, 50, 26, 9, "readings\nts, count, level, density", C["data"], 8.5)
    box(ax, 150, 50, 25, 9, "data/frames/<id>.jpg\nlatest annotated frame", C["data"], 8.5)
    arrow(ax, (105, 62), (118, 56), "store", off=(0, 1.2))
    group(ax, 46, 4, 132, 32, "API + UI", C["client"])
    box(ax, 49, 10, 30, 18, "GET /temples, /temples/{id}\n/temples/{id}/readings\nCRUD temples + cameras\n(X-API-Key if ADMIN_API_KEY)", C["api"], 8.5)
    box(ax, 84, 10, 40, 18, "Temple pages\n/temples list + register form\n/temples/[id]: KPIs, 24h chart, cameras,\ncapture now, test feed, ingest URL", C["client"], 8.5)
    box(ax, 129, 10, 46, 18, "Dashboard + Alerts\ntemple status and pie from real counts\nalerts from Warning/Critical readings\n(temple total = sum of online cameras)", C["client"], 8.5)
    arrow(ax, (140, 44), (100, 28), "read", off=(0, 1)); arrow(ax, (79, 19), (84, 19))
    arrow(ax, (124, 19), (129, 19))
    ax.text(2, 1, "A camera with no reading for 15 min is offline. Cameras with a zone capacity are judged on 70 % / 90 % of that zone, others on the temple's Warning / Critical.", fontsize=8.5)
    fig.savefig(f"{OUT}/camera_integration.png", dpi=150, bbox_inches="tight"); plt.close(fig)


if __name__ == "__main__":
    system(); csrnet(); lstm(); pipeline(); fallback(); cameras()
    try:
        density()
    except Exception as e:
        print("density figure skipped:", e)
    print("diagrams written to", OUT)
