# Known limitations and honest compatibility statement

- Every regular file can be opened, displayed, edited, searched, hashed, compared, and exported as bytes.
- “Format support” beyond that means identification, structural parsing, decompression, decoding, or previewing.
- Proprietary, encrypted, damaged, vendor-specific, and undocumented variants cannot be guaranteed.
- The signature engine included here is intentionally conservative and far smaller than HexEd.it's current database.
- RAW camera formats are a family, not one format. Add vendor-specific parsers/decoders such as LibRaw compiled to WebAssembly for previews.
- Archive content listing requires decompressors for each algorithm and safe resource limits to prevent decompression bombs.
- Disk images and virtual disks need filesystem/partition parsers; raw hex editing remains available without them.
- Firmware and UEFI parsing needs architecture/vendor-specific rules and should not infer trust or safety from signatures alone.
- Regex searching is limited to 64 MiB because character-to-byte offset mapping becomes expensive; use byte/text search for large files.
- PDF reports intentionally cap large tables to keep generation responsive and the PDF readable.
