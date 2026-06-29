# OpenNeural: Academic Researcher User Guide

Welcome to **OpenNeural**! This guide is designed for academic researchers, domain experts, and social scientists who want to build, evaluate, and deploy high-quality machine learning models without needing a PhD in machine learning or writing a single line of code.

OpenNeural is a fully local, secure desktop application that guides you through the entire machine learning lifecycle—from raw data import to model deployment—using a structured, step-by-step wizard.

---

## The OpenNeural Lifecycle

The application is structured as a wizard-driven workflow containing the following phases:

```
[1. Launch & Auth] ──> [2. Create Project] ──> [3. Import Dataset] ──> [4. Design Pipeline]
                                                                             │
[8. Export & Verify] <── [7. Evaluate & Adjust] <── [6. AutoML Training] <───┘
```

---

## Step-by-Step Walkthrough

### Step 1: Secure Initial Setup (First Launch)
> **Step Purpose**: To establish local credentials and safeguard your research data, this screen requires you to configure a master password on your first launch.

When you open OpenNeural for the first time, you will be prompted to set a master password.
- **Why this matters**: Because OpenNeural runs entirely on your local machine, your data and models never leave your computer. This password is used to encrypt local settings and protect unauthorized access to your projects.
- **Action**: Enter a strong password of at least 8 characters and click **Initialize App**. Write down or safely store this password, as it cannot be reset if forgotten (designed to maintain strict data privacy).

---

### Step 2: Create a New Research Project
> **Step Purpose**: A project serves as a secure, isolated workspace that groups your datasets, custom pipelines, and trained models under a specific research objective.

1. On the dashboard, click **New Project**.
2. Fill in the following details:
   - **Project Name**: Give your project a clear, descriptive name (e.g., `Cardiovascular Risk Prediction 2026`).
   - **Description**: Add research notes, hypotheses, or general context.
   - **Task Type**: Select the type of predictive task you want to perform:
     - **Binary Classification**: Use this when predicting one of two possible outcomes (e.g., `Healthy` vs. `High Risk`, `Approve` vs. `Reject`).
     - **Multi-class Classification**: Use this when predicting one of several distinct categories (e.g., `Low`, `Medium`, or `High` risk).
     - **Regression**: Use this when predicting a continuous numerical value (e.g., `Blood Pressure`, `Years of Survival`).
3. Click **Create Project**.

---

### Step 3: Import Your Research Dataset
> **Step Purpose**: This step imports your tabular data, computes secure checksums to guarantee data integrity, and extracts descriptive schema metadata.

1. Click **Import Dataset** (or **Upload CSV**).
2. Choose a CSV or Parquet file from your local hard drive.
3. Once loaded, the system will ask you to designate a **Target Column** (the column containing the outcome you want to predict).
4. Review the auto-detected columns and data types (Numerical vs. Categorical).
5. **Data Integrity Check**: OpenNeural automatically generates a SHA-256 checksum of your dataset. This ensures that if the source file is modified or tampered with later, the application will flag the mismatch and protect your scientific reproducibility.

---

### Step 4: Design Your Preprocessing Pipeline (The Pipeline Builder)
> **Step Purpose**: The Pipeline Builder allows you to design a sequence of data-cleaning blocks to format, normalize, and handle missing values in your dataset before feeding it to models.

The Pipeline Builder uses a drag-and-drop or step-by-step block sequence:
1. **Handle Missing Values**:
   - Choose how to handle empty cells (e.g., replace numerical missing values with the `median` or `mean`, and categorical ones with the `most frequent` value).
2. **Feature Scaling** (Numerical columns):
   - Choose **Standard Scaler** (adjusts data to have a mean of 0 and variance of 1) or **Min-Max Scaler** (scales all values to be between 0 and 1). Recommended for algorithms like Logistic Regression or SVMs.
3. **One-Hot Encoding** (Categorical columns):
   - Converts text labels (e.g., `Male`, `Female`) into numerical columns that machine learning algorithms can understand.
4. **Subgroup Slice Definition** (Crucial for Bias & Fairness Audit):
   - Specify demographic or categorical columns (e.g., `Gender`, `Age Group`) that you want to audit for fairness. The system will track performance separately for each group in the evaluation phase.
5. Click **Validate and Save Pipeline**.

---

### Step 5: Start AutoML Training
> **Step Purpose**: AutoML automatically searches, tunes, and compares multiple machine learning algorithms to find the absolute best-performing model for your pipeline.

1. Select the models you want to train. For tabular datasets, OpenNeural supports:
   - **Logistic Regression**: A simple, highly interpretable baseline.
   - **Random Forest**: An ensemble of decision trees, great for capturing non-linear relationships.
   - **XGBoost**: A high-performance gradient-boosted tree model, often delivering the highest predictive accuracy.
2. Select an **Optimization Metric**:
   - **F1-Score (Recommended)**: Balances precision and recall; excellent for imbalanced datasets (e.g., rare diseases).
   - **AUC-ROC**: Measures the model's ability to distinguish between classes.
   - **Precision**: Minimizes false positives (useful if false alarms are costly).
   - **Recall**: Minimizes false negatives (useful if missing a positive case is critical).
3. Select your **AutoML Budget**:
   - **Max Trials**: The number of hyperparameter combinations to try (e.g., 25 trials).
   - **Time Budget**: Limit training time (e.g., 8 minutes).
4. **Advisory Time Estimate**: Before clicking start, review the pre-training time estimate. This tells you approximately how long training will take based on your CPU power, rows, features, and model count.
5. Click **Start AutoML**. Watch real-time CPU, RAM, and progress indicators as models train safely on your hardware.

---

### Step 6: Evaluate Model Performance & Fairness
> **Step Purpose**: The Evaluation Dashboard displays deep analytical metrics, lets you interactively adjust decision thresholds, and reports performance across subgroups.

Once AutoML completes, you will be taken to the **Evaluation Dashboard** highlighting the top-performing model.

#### 1. Performance Metrics & Confusion Matrix
- **Confusion Matrix**: Shows a table of correct and incorrect predictions:
  - **True Positives (TP)**: Correctly predicted positive outcomes.
  - **True Negatives (TN)**: Correctly predicted negative outcomes.
  - **False Positives (FP)**: False alarms.
  - **False Negatives (FN)**: Missed detections.

#### 2. Interactive Threshold Adjustment (Classification Only)
- By default, classification models decide if a row is "positive" using a 50% probability threshold (0.50).
- Use the **Decision Threshold Slider** (adjustable between 0.10 and 0.90 in increments of 0.05) to see how shifting the threshold changes F1, Precision, and Recall in real-time.
- *How to use this*: If your research demands high sensitivity (e.g., detecting a disease), lower the threshold to increase Recall. If you need high certainty (e.g., drug efficacy), raise the threshold to increase Precision.

#### 3. Subgroup / Bias Analysis
- Review the **Subgroup Performance** table for the variables you marked in Step 4.
- This shows if the model performs significantly worse on certain demographics or cohorts (e.g., lower F1-score on younger populations), allowing you to audit your model for bias before publishing.

---

### Step 7: Export Model & Verify Integrity
> **Step Purpose**: Export your fully trained model, pipeline configurations, and audit reports as packaged artifacts with verifiable cryptographic checksums.

1. On the Evaluation tab, click **Export Artifacts**.
2. Select your export format:
   - **ONNX Model File**: A standardized cross-platform model format that can be loaded in Python, R, C#, or C++ for external predictions.
   - **Pipeline JSON**: Full preprocessing steps and parameters.
   - **Evaluation Summary PDF/JSON**: Reproducible report containing metrics, thresholds, and subgroup analysis tables.
3. OpenNeural writes these files to your chosen export directory and generates an accompanying **SHA-256 checksum file** (e.g., `model_onnx.sha256`).
4. **Scientific Verification**: You can share the checksum file alongside your research paper. Other researchers can run a standard checksum utility on the exported model to guarantee it is identical to the one you generated, ensuring complete scientific reproducibility.

---

## Machine Learning Concepts for Non-Experts

Here is a quick reference table of common terms you will encounter in OpenNeural:

| Term | Scientific Analog / Meaning | Why it matters to your research |
| :--- | :--- | :--- |
| **Imputation** | Filling in missing questionnaire or experimental values. | Ensures your model doesn't fail due to empty spreadsheet cells. |
| **Bcrypt Hashing** | A high-security, mathematically slow password scrambling system. | Protects your app credentials from unauthorized local access. |
| **F1-Score** | Harmonic mean of Precision and Recall. | Highly recommended when your positive outcome of interest is rare (e.g. < 5% of rows). |
| **Overfitting** | When a model "memorizes" your dataset instead of learning general patterns. | OpenNeural uses Cross-Validation (CV) to prevent this, ensuring the model performs well on new data. |
| **ONNX** | Open Neural Network Exchange. | Ensures your model is not locked into OpenNeural and can be run in any programming language. |
