# Extending OpenNeural

OpenNeural is designed with modularity in mind. Developers and researchers can easily extend the platform's capabilities by adding custom **preprocessing block types** or **machine learning model types**.

This document provides a comprehensive guide and worked examples for both extension points.

---

## 1. Adding New Preprocessing Block Types

All preprocessing steps in OpenNeural are encapsulated as **Pipeline Blocks**. Blocks must subclass `PipelineBlock` and register themselves with the central `BLOCK_REGISTRY` using a decorator.

### 1.1 The Block Interface
Every pipeline block must implement:
- **`block_type`**: A unique string identifying the block type (used for serialization/deserialization).
- **`param_schema`**: A dictionary specifying the parameters the block accepts (for UI generation and backend validation).
- **`fit(X, y)`**: Learns fit-time statistics from a Pandas DataFrame.
- **`transform(X)`**: Transforms a Pandas DataFrame and returns the modified DataFrame.

### 1.2 Worked Example: Robust Outlier Clipper Block
Let's implement a block that clips outlier values in numerical columns to a specified percentile range (e.g., 1st to 99th percentile) to reduce the influence of extreme values.

```python
import pandas as pd
import numpy as np
from typing import Any
from openneural_backend.pipeline.block_interface import PipelineBlock
from openneural_backend.pipeline.registry import register_block

@register_block
class OutlierClipperBlock(PipelineBlock):
    """Pipeline block that clips numerical columns to a specified percentile range."""
    
    # 1. Unique block identifier
    block_type = "outlier_clipper"
    
    # 2. Parameter validation schema
    param_schema = {
        "lower_percentile": {
            "type": "number",
            "minimum": 0.0,
            "maximum": 10.0,
            "default": 1.0,
            "description": "Lower percentile to clip values to"
        },
        "upper_percentile": {
            "type": "number",
            "minimum": 90.0,
            "maximum": 100.0,
            "default": 99.0,
            "description": "Upper percentile to clip values to"
        },
        "columns": {
            "type": "array",
            "items": {"type": "string"},
            "required": False,
            "description": "List of columns to clip. If not provided, clips all numerical columns."
        }
    }

    def __init__(self, **params: Any) -> None:
        super().__init__(**params)
        self.lower_percentile = params.get("lower_percentile", 1.0)
        self.upper_percentile = params.get("upper_percentile", 99.0)
        self.columns = params.get("columns", None)
        self.clip_limits_ = {}  # Will store fitted limits: {col_name: (lower_val, upper_val)}

    def fit(self, X: pd.DataFrame, y: pd.Series | None = None) -> "OutlierClipperBlock":
        """Identify target columns and compute percentile limits."""
        # Determine columns to process
        cols_to_fit = self.columns
        if cols_to_fit is None:
            # Select all numerical columns automatically
            cols_to_fit = X.select_dtypes(include=[np.number]).columns.tolist()

        # Compute limits for each column
        for col in cols_to_fit:
            if col in X.columns:
                lower_val = np.percentile(X[col].dropna(), self.lower_percentile)
                upper_val = np.percentile(X[col].dropna(), self.upper_percentile)
                self.clip_limits_[col] = (lower_val, upper_val)
        
        self._is_fitted = True
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Apply pre-computed percentile limits to clip values."""
        if not self._is_fitted:
            raise RuntimeError("OutlierClipperBlock must be fitted before transforming.")
            
        X_out = X.copy()
        for col, (lower_val, upper_val) in self.clip_limits_.items():
            if col in X_out.columns:
                X_out[col] = X_out[col].clip(lower=lower_val, upper=upper_val)
                
        return X_out
```

### 1.3 How to Register Your Custom Block
Because our block uses the `@register_block` decorator, simply importing the block file during application initialization registers it automatically. Add your custom block module to `backend/openneural_backend/pipeline/registry.py`'s imports or standard blocks initialization helper.

---

## 2. Adding New Model Types

All machine learning models trained by the OpenNeural AutoML engine are represented by a `ModelSpec` dataclass registered under the `MODEL_REGISTRY`.

### 2.1 The ModelSpec Dataclass
To register a new model type, instantiate and register a `ModelSpec`:
- **`model_class`**: The Python class of the model/estimator (scikit-learn compatible, i.e., implements `.fit()`, `.predict()`, and `.predict_proba()`).
- **`task_types`**: A list of task types the model supports (e.g. `["classification"]`, `["regression"]`).
- **`default_params`**: Dict of fallback/default hyperparameters.
- **`search_space`**: Optuna hyperparameter tuning search space. Search space specs are defined as tuples:
  - `("int", low, high)` for integer ranges.
  - `("float", low, high)` or `("loguniform", low, high)` for continuous values.
  - `("categorical", [choices])` for categorical options.

### 2.2 Worked Example: Support Vector Machine (SVM) Classifier
Let's add the scikit-learn Support Vector Machine (SVC) to OpenNeural's classification models.

```python
from sklearn.svm import SVC
from openneural_backend.models.registry import ModelSpec, register_model

# 1. Instantiate the Model Specification
svm_spec = ModelSpec(
    # The actual estimator class
    model_class=SVC,
    
    # Supported task types (SVC is for classification)
    task_types=["classification"],
    
    # Default parameters for baseline runs
    default_params={
        "probability": True,  # Required for threshold slider & ROC metrics
        "random_state": 42
    },
    
    # Hyperparameter tuning search space for Optuna
    search_space={
        "C": ("loguniform", 1e-3, 1e2),
        "kernel": ("categorical", ["linear", "rbf", "poly"]),
        "degree": ("int", 2, 5),      # Only used if kernel is 'poly'
        "gamma": ("categorical", ["scale", "auto"])
    }
)

# 2. Register with MODEL_REGISTRY
register_model("svm_classifier", svm_spec)
```

### 2.3 Integrating Your Custom Model into AutoML
1. Register your model in `backend/openneural_backend/models/registry.py` under `initialize_model_registry()`.
2. Ensure your custom model key (e.g., `"svm_classifier"`) is included in the React frontend candidate models selection checklist so that researchers can toggle it on or off for AutoML experiments!
