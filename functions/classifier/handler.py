import numpy as np
import pandas, sklearn, lightgbm, optuna, pymongo

def handler(event, context):
    return {
        "numpy": np.__version__,
        "pandas": pandas.__version__,
        "scikit-learn": sklearn.__version__,
        "lightgbm": lightgbm.__version__,
        "optuna": optuna.__version__,
        "pymongo": pymongo.__version__,
    }