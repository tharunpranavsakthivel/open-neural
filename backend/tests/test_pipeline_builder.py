import pytest
from sklearn.pipeline import Pipeline as SklearnPipeline
from sklearn.preprocessing import StandardScaler

from openneural_backend.pipeline.blocks.drop_nulls import DropNullsBlock
from openneural_backend.pipeline.blocks.split import TrainValTestSplitBlock
from openneural_backend.pipeline.builder import (
    build_pipeline_config,
    build_sklearn_pipeline,
    extract_split_block,
    instantiate_block,
)


def test_build_sklearn_pipeline_invalid_inputs() -> None:
    # config_json must be a dict
    with pytest.raises(ValueError, match="config_json must be a dict"):
        build_sklearn_pipeline("not a dict")

    # missing 'blocks' key
    with pytest.raises(ValueError, match="must contain a 'blocks' key"):
        build_sklearn_pipeline({"other": "key"})

    # non-list 'blocks'
    with pytest.raises(ValueError, match="'blocks' must be a list"):
        build_sklearn_pipeline({"blocks": "not a list"})

    # non-dict block config
    with pytest.raises(ValueError, match="must be a dict"):
        build_sklearn_pipeline({"blocks": ["not a dict"]})

    # block config missing 'type'
    with pytest.raises(ValueError, match="missing 'type' key"):
        build_sklearn_pipeline({"blocks": [{"params": {}}]})

    # non-string block type
    with pytest.raises(ValueError, match="must be a string"):
        build_sklearn_pipeline({"blocks": [{"type": 123}]})

    # non-dict block params
    with pytest.raises(ValueError, match="must be a dict"):
        build_sklearn_pipeline(
            {"blocks": [{"type": "drop_nulls", "params": "not a dict"}]}
        )

    # unregistered block type
    with pytest.raises(KeyError, match="is not registered"):
        build_sklearn_pipeline({"blocks": [{"type": "nonexistent_block_type_123"}]})

    # block instantiation failure
    with pytest.raises(ValueError, match="Failed to instantiate block"):
        # TrainValTestSplitBlock instantiation fails if ratios don't sum to 1.0
        build_sklearn_pipeline(
            {
                "blocks": [
                    {
                        "type": "train_val_test_split",
                        "params": {"train": 0.5, "val": 0.1, "test": 0.1},
                    }
                ]
            }
        )

    # multiple split blocks
    with pytest.raises(
        ValueError, match="Multiple train_val_test_split blocks are not allowed"
    ):
        build_sklearn_pipeline(
            {
                "blocks": [
                    {
                        "type": "train_val_test_split",
                        "params": {"train": 0.8, "val": 0.1, "test": 0.1},
                    },
                    {
                        "type": "train_val_test_split",
                        "params": {"train": 0.8, "val": 0.1, "test": 0.1},
                    },
                ]
            }
        )


def test_instantiate_block_errors() -> None:
    with pytest.raises(KeyError):
        instantiate_block("nonexistent_block_type_123")

    with pytest.raises(ValueError, match="Failed to instantiate block"):
        instantiate_block(
            "train_val_test_split", {"train": 0.5, "val": 0.1, "test": 0.1}
        )


def test_extract_split_block_errors() -> None:
    split1 = TrainValTestSplitBlock(train=0.8, val=0.1, test=0.1)
    split2 = TrainValTestSplitBlock(train=0.8, val=0.1, test=0.1)
    drop = DropNullsBlock()

    with pytest.raises(
        ValueError, match="Multiple TrainValTestSplitBlock instances found"
    ):
        extract_split_block([split1, split2])

    # Test extracting split block with a non-split block in the list (covers line 187-189 in builder.py)
    tx_blocks, found_split = extract_split_block([drop, split1])
    assert len(tx_blocks) == 1
    assert tx_blocks[0] is drop
    assert found_split is split1


def test_build_pipeline_config_serialization() -> None:
    # Create standard sklearn step along with custom step
    drop_block = DropNullsBlock(columns=["col_a"])
    scaler = StandardScaler()

    pipeline = SklearnPipeline(
        steps=[
            ("step_0_drop_nulls", drop_block),
            ("step_1_scaler", scaler),
        ]
    )

    split_config = {
        "train": 0.7,
        "val": 0.15,
        "test": 0.15,
        "stratify_column": "target",
    }

    config = build_pipeline_config(pipeline, split_config)
    assert "blocks" in config
    blocks = config["blocks"]
    assert len(blocks) == 3

    assert blocks[0]["type"] == "drop_nulls"
    assert blocks[1]["type"] == "StandardScaler"
    assert blocks[2]["type"] == "train_val_test_split"
    assert blocks[2]["params"]["stratify_column"] == "target"


def test_pipeline_block_get_set_params() -> None:
    drop_block = DropNullsBlock(columns=["col_a"])
    params = drop_block.get_params()
    assert params == {"columns": ["col_a"]}

    drop_block.set_params(columns=["col_b"])
    assert drop_block.get_params() == {"columns": ["col_b"]}


def test_pipeline_registry() -> None:
    from openneural_backend.pipeline.block_interface import PipelineBlock
    from openneural_backend.pipeline.registry import (
        BLOCK_REGISTRY,
        _register_builtin_blocks,
        clear_registry,
        get_block,
        is_registered,
        list_blocks,
        register_block,
        unregister_block,
    )

    # Test ValueError when class has no block_type
    class InvalidBlockNoType(PipelineBlock):
        pass

    with pytest.raises(ValueError, match="block_type class attribute is not defined"):
        register_block(InvalidBlockNoType)

    # Test ValueError when class block_type is not string
    class InvalidBlockNonStrType(PipelineBlock):
        block_type = 123  # type: ignore

    with pytest.raises(ValueError, match="block_type must be a string"):
        register_block(InvalidBlockNonStrType)

    # Save original registry to restore later
    original_registry = dict(BLOCK_REGISTRY)

    try:
        # Test registering a duplicate block type
        class DummyBlock1(PipelineBlock):
            block_type = "dummy_test_block"

        class DummyBlock2(PipelineBlock):
            block_type = "dummy_test_block"

        register_block(DummyBlock1)
        with pytest.raises(ValueError, match="is already registered"):
            register_block(DummyBlock2)

        # Test is_registered and get_block
        assert is_registered("dummy_test_block") is True
        assert is_registered("nonexistent_block") is False

        assert get_block("dummy_test_block") is DummyBlock1
        assert get_block("nonexistent_block") is None

        # Test list_blocks
        blocks = list_blocks()
        assert "dummy_test_block" in blocks
        assert blocks["dummy_test_block"] == "DummyBlock1"

        # Test unregister_block
        assert unregister_block("dummy_test_block") is True
        assert unregister_block("nonexistent_block") is False
        assert is_registered("dummy_test_block") is False

        # Test clear_registry
        clear_registry()
        assert len(BLOCK_REGISTRY) == 0

        # Re-register builtin blocks to restore state
        _register_builtin_blocks()
        assert len(BLOCK_REGISTRY) > 0

        # Cover PipelineBlock abstract method pass statements
        class DummyBaseCaller(PipelineBlock):
            block_type = "dummy_base"

            def fit(self, X, y=None):
                super().fit(X, y)
                return self

            def transform(self, X):
                super().transform(X)
                return X

            def to_sklearn(self):
                super().to_sklearn()
                return None

        dummy = DummyBaseCaller()
        dummy.fit(None)
        dummy.transform(None)
        dummy.to_sklearn()

    finally:
        # Guarantee cleanup and restore registry state
        BLOCK_REGISTRY.clear()
        BLOCK_REGISTRY.update(original_registry)
