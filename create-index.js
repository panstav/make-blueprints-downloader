import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function main() {
	const downloadsDir = path.join(__dirname, "downloads");
	const indexFile = path.join(__dirname, "index.txt");

	try {
		const files = await fs.readdir(downloadsDir);
		const filenames = [];

		for (const file of files) {
			const filePath = path.join(downloadsDir, file);
			const stat = await fs.stat(filePath);
			if (stat.isFile()) {
				filenames.push(file);
			}
		}

		const content = filenames.join("\n") + (filenames.length > 0 ? "\n" : "");
		await fs.writeFile(indexFile, content, "utf8");
		console.log(`Successfully indexed ${filenames.length} file(s) into index.txt.`);
	} catch (error) {
		console.error("Error generating index:", error.message);
		process.exit(1);
	}
}

if (process.argv[1] === __filename) {
	main().catch(error => {
		console.error("Fatal Error:", error.message);
		process.exit(1);
	});
}
