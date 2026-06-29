# -*- mode: python ; coding: utf-8 -*-
import sys
import os
from PyInstaller.utils.hooks import collect_data_files

block_cipher = None

# Collect any data files inside the openneural_backend package
datas = collect_data_files('openneural_backend')

# Add Alembic migrations and alembic.ini config
# Path is relative to the backend directory
datas.append(('alembic', 'alembic'))
datas.append(('alembic.ini', '.'))

# Explicitly declare hidden imports to ensure dynamically-loaded modules are included
hiddenimports = [
    'uvicorn',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'alembic',
    'sqlalchemy',
    'sqlite3',
    'pandas',
    'pyarrow',
    'xgboost',
    'optuna',
    'joblib',
    'skl2onnx',
    'onnx',
    'reportlab',
    'bcrypt',
    'openneural_backend',
]

# Exclude unnecessary standard library modules to keep bundle size small
excludes = [
    'tkinter',
    'tcl',
    'idlelib',
    'unittest',
    'pdb',
    'pydoc',
    'lib2to3',
]

a = Analysis(
    ['openneural_backend/__main__.py'],
    pathex=['src'],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='openneural_backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='openneural_backend',
)
