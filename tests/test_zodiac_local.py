"""Compatibility test entrypoint; domain cases live in tests.zodiac_local_cases."""

from tests.zodiac_local_cases.support import (
    package_files,
    valid_timing,
    write_package,
    write_pcm,
)

from tests.zodiac_local_cases.package import (
    SafeExtractionTests,
    ThinPackageV3Tests,
    ThinPackageV4Tests,
)

from tests.zodiac_local_cases.runtime import (
    PerformanceRuntimeV316Tests,
    RuntimeOwnedAnimationV3191Tests,
    SharedRuntimeCacheRepairTests,
    RuntimeManifestIntegrityTests,
    RuntimeV3210StyleContractTests,
    RuntimeLayerSafetyV3200Tests,
    SemanticRuntimeV315Tests,
    RendererTypeCompatTests,
)

from tests.zodiac_local_cases.timing_voice import (
    RuntimeTimingTests,
    TtsDurationGuardTests,
    VieNeuGradioEndpointTests,
    TtsDiagnosticsRegressionTests,
)

from tests.zodiac_local_cases.output import (
    FinalOutputTests,
    RendererPrepareCacheTests,
    ArtifactFingerprintTests,
    BackgroundMusicTests,
    PlaybackRateTests,
)

__all__ = [
    "package_files",
    "valid_timing",
    "write_package",
    "write_pcm",
    "SafeExtractionTests",
    "ThinPackageV3Tests",
    "ThinPackageV4Tests",
    "PerformanceRuntimeV316Tests",
    "RuntimeOwnedAnimationV3191Tests",
    "SharedRuntimeCacheRepairTests",
    "RuntimeManifestIntegrityTests",
    "RuntimeV3210StyleContractTests",
    "RuntimeLayerSafetyV3200Tests",
    "SemanticRuntimeV315Tests",
    "RendererTypeCompatTests",
    "RuntimeTimingTests",
    "TtsDurationGuardTests",
    "VieNeuGradioEndpointTests",
    "TtsDiagnosticsRegressionTests",
    "FinalOutputTests",
    "RendererPrepareCacheTests",
    "ArtifactFingerprintTests",
    "BackgroundMusicTests",
    "PlaybackRateTests",
]

if __name__ == "__main__":
    import unittest
    unittest.main()