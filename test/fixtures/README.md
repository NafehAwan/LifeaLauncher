# Test fixtures

These JSON files are **hand-written** from the documented Mojang / Fabric / Modrinth formats, trimmed to the fields the
launcher reads. The build environment that produced them could not reach piston-meta.mojang.com, meta.fabricmc.net or
api.modrinth.com. When network access is available, replace them with real responses
(`curl https://piston-meta.mojang.com/v1/packages/<sha>/1.21.4.json`, etc.) and keep the tests green.
