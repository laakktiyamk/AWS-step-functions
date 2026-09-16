import rasterio, numpy as np, base64, io
from PIL import Image
from rasterio.windows import from_bounds
import pandas, sklearn, lightgbm, optuna, pymongo

def handler(event, context):

    '''
    if event.get('action') == 'test_imports':
        return {
            "numpy": np.__version__,
            "pandas": pandas.__version__,
            "scikit-learn": sklearn.__version__,
            "lightgbm": lightgbm.__version__,
            "optuna": optuna.__version__,
            "pymongo": pymongo.__version__,
        }
        '''
    def open_path(p):
        return p if p.startswith("/vsi") or p.startswith("http") else f"/vsicurl/{p}"

    b04_path = open_path(event['B04'])
    b08_path = open_path(event['B08'])

    with rasterio.Env(
        GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',
        VSI_CACHE=True,
        VSI_CACHE_SIZE=100_000_000,
        CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif,.TIF,.jp2,.xml'
    ):
        with rasterio.open(b04_path) as b04, \
             rasterio.open(b08_path) as b08:

            win = from_bounds(*event['bbox'], transform=b04.transform)

            red = b04.read(1, window=win, out_shape=(512,512), boundless=True, fill_value=0).astype(np.float32)
            nir = b08.read(1, window=win, out_shape=(512,512), boundless=True, fill_value=0).astype(np.float32)

            valid = (red != 0) | (nir != 0)
            ndvi = np.where(valid, (nir - red) / (nir + red + 1e-6), np.nan)

            stats = {
                "mean": float(np.nanmean(ndvi)),
                "min": float(np.nanmin(ndvi)),
                "max": float(np.nanmax(ndvi))
            }

            norm = ((np.nan_to_num(ndvi, nan=-1) + 1) / 2 * 255).clip(0,255).astype(np.uint8)
            buf = io.BytesIO()
            Image.fromarray(norm).save(buf, format='PNG')

            return {"date": event['date'], "field_id": event['field_id'], "stats": stats, "image": base64.b64encode(buf.getvalue()).decode()}