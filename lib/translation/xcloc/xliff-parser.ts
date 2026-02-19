// ============================================================
// XLIFF 1.2 Parser & Serializer for Xcode xcloc bundles
// Pure regex-based — no DOMParser dependency, works in Node/Bun/browser.
// ============================================================

export interface XliffTransUnit {
	id: string;
	source: string;
	target?: string;
	note?: string;
}

export interface XliffFile {
	original: string;
	sourceLanguage: string;
	targetLanguage: string;
	datatype: string;
	tool?: {
		id: string;
		name: string;
		version: string;
		buildNum: string;
	};
	transUnits: XliffTransUnit[];
}

export interface XliffDocument {
	version: string;
	files: XliffFile[];
}

// ---- XML entity helpers ----------------------------------------

function escapeXml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function unescapeXml(text: string): string {
	return text
		.replace(/&quot;/g, '"')
		.replace(/&gt;/g, ">")
		.replace(/&lt;/g, "<")
		.replace(/&amp;/g, "&");
}

/** Extract text content between an opening and closing XML tag.
 *  Handles self-closing tags like <source/> and empty tags like <source></source>. */
function extractTagContent(
	xml: string,
	tagName: string,
): string | undefined {
	// Match self-closing <tag/> — content is empty string
	const selfCloseRe = new RegExp(`<${tagName}\\s*/>`);
	if (selfCloseRe.test(xml)) return "";

	// Match <tag>...</tag> or <tag ...>...</tag> (non-greedy, dotAll)
	const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, "m");
	const match = xml.match(re);
	if (!match) return undefined;
	return unescapeXml(match[1]);
}

/** Extract an attribute value from an XML tag string. */
function getAttr(tagStr: string, attrName: string): string {
	const re = new RegExp(`${attrName}="([^"]*)"`, "m");
	const match = tagStr.match(re);
	return match ? unescapeXml(match[1]) : "";
}

// ---- Parse -----------------------------------------------------

export function parseXliff(xml: string): XliffDocument {
	// Extract version from <xliff> tag
	const xliffMatch = xml.match(/<xliff\s[^>]*version="([^"]*)"[^>]*>/);
	const version = xliffMatch ? xliffMatch[1] : "1.2";

	const files: XliffFile[] = [];

	// Split into <file>...</file> blocks
	const fileBlocks = xml.match(/<file\s[^>]*>[\s\S]*?<\/file>/g) ?? [];

	for (const fileBlock of fileBlocks) {
		const fileTag = fileBlock.match(/<file\s[^>]*>/)?.[0] ?? "";

		const original = getAttr(fileTag, "original");
		const sourceLanguage = getAttr(fileTag, "source-language");
		const targetLanguage = getAttr(fileTag, "target-language");
		const datatype = getAttr(fileTag, "datatype") || "plaintext";

		// Parse <tool> from <header>
		let tool: XliffFile["tool"];
		const toolMatch = fileBlock.match(/<tool\s[^/]*\/>/);
		if (toolMatch) {
			const toolTag = toolMatch[0];
			tool = {
				id: getAttr(toolTag, "tool-id"),
				name: getAttr(toolTag, "tool-name"),
				version: getAttr(toolTag, "tool-version"),
				buildNum: getAttr(toolTag, "build-num"),
			};
		}

		// Parse <trans-unit> elements
		const transUnits: XliffTransUnit[] = [];
		const tuBlocks =
			fileBlock.match(/<trans-unit\s[^>]*>[\s\S]*?<\/trans-unit>/g) ?? [];

		for (const tuBlock of tuBlocks) {
			const tuTag = tuBlock.match(/<trans-unit\s[^>]*>/)?.[0] ?? "";
			const id = getAttr(tuTag, "id");

			const source = extractTagContent(tuBlock, "source") ?? "";
			const target = extractTagContent(tuBlock, "target");
			const noteContent = extractTagContent(tuBlock, "note");
			const note = noteContent || undefined;

			transUnits.push({ id, source, target, note });
		}

		files.push({
			original,
			sourceLanguage,
			targetLanguage,
			datatype,
			tool,
			transUnits,
		});
	}

	return { version, files };
}

// ---- Serialize -------------------------------------------------

export function serializeXliff(doc: XliffDocument): string {
	const lines: string[] = [];
	lines.push('<?xml version="1.0" encoding="UTF-8"?>');
	lines.push(
		`<xliff xmlns="urn:oasis:names:tc:xliff:document:1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" version="${doc.version}" xsi:schemaLocation="urn:oasis:names:tc:xliff:document:1.2 http://docs.oasis-open.org/xliff/v1.2/os/xliff-core-1.2-strict.xsd">`,
	);

	for (const file of doc.files) {
		lines.push(
			`  <file original="${escapeXml(file.original)}" source-language="${escapeXml(file.sourceLanguage)}" target-language="${escapeXml(file.targetLanguage)}" datatype="${escapeXml(file.datatype)}">`,
		);

		lines.push("    <header>");
		if (file.tool) {
			lines.push(
				`      <tool tool-id="${escapeXml(file.tool.id)}" tool-name="${escapeXml(file.tool.name)}" tool-version="${escapeXml(file.tool.version)}" build-num="${escapeXml(file.tool.buildNum)}"/>`,
			);
		}
		lines.push("    </header>");

		lines.push("    <body>");

		for (const tu of file.transUnits) {
			lines.push(
				`      <trans-unit id="${escapeXml(tu.id)}" xml:space="preserve">`,
			);
			lines.push(`        <source>${escapeXml(tu.source)}</source>`);
			if (tu.target !== undefined) {
				lines.push(`        <target>${escapeXml(tu.target)}</target>`);
			}
			lines.push(`        <note>${tu.note ? escapeXml(tu.note) : ""}</note>`);
			lines.push("      </trans-unit>");
		}

		lines.push("    </body>");
		lines.push("  </file>");
	}

	lines.push("</xliff>");
	return lines.join("\n");
}
