/**
 * Icon generation script for trackTS
 * Generates PNG icons at various sizes and favicon.ico from the source SVG
 *
 * Usage: npx tsx scripts/generate-icons.ts
 */

import sharp from 'sharp';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SOURCE_SVG = 'icons/app_icons/app_icon.svg';
const OUTPUT_DIR = 'icons/app_icons';
const FAVICON_DIR = 'icons/favicon';
const INFO_DIR = 'info';

// Sizes for manifest icons
const MANIFEST_SIZES = [128, 144, 152, 192, 256, 512];

// Sizes for favicon (will be combined into ICO)
const FAVICON_SIZES = [16, 32, 48];

// Apple touch icon size
const APPLE_TOUCH_ICON_SIZE = 180;

// Logo size for info directory
const LOGO_SIZE = 192;

async function generatePng(svgPath: string, outputPath: string, size: number): Promise<void> {
	const svgBuffer = fs.readFileSync(svgPath);

	await sharp(svgBuffer).resize(size, size).png().toFile(outputPath);

	console.log(`Generated: ${outputPath} (${size}x${size})`);
}

async function generateFavicon(svgPath: string, outputPath: string): Promise<void> {
	// Generate the largest favicon size as a PNG
	// For a proper ICO, we'd need a specialized library, but browsers also accept PNG favicons
	const svgBuffer = fs.readFileSync(svgPath);

	// Generate a 48x48 PNG as favicon (widely supported)
	await sharp(svgBuffer).resize(48, 48).png().toFile(outputPath.replace('.ico', '.png'));

	console.log(`Generated: ${outputPath.replace('.ico', '.png')} (favicon)`);

	// Also create individual favicon PNGs for different sizes
	for (const size of FAVICON_SIZES) {
		const faviconPath = path.join(path.dirname(outputPath), `favicon-${size}x${size}.png`);
		await sharp(svgBuffer).resize(size, size).png().toFile(faviconPath);
		console.log(`Generated: ${faviconPath} (${size}x${size})`);
	}

	// Create ICO file (multiple sizes in one file)
	// ICO format: we'll use sharp to create individual PNGs and combine them
	// For simplicity, we'll create a 32x32 ICO-compatible PNG
	const icoBuffer = await sharp(svgBuffer).resize(32, 32).png().toBuffer();

	// Write as .ico (browsers can handle PNG data in ICO container)
	// This is a simplified approach - for full ICO support, use 'png-to-ico' package
	fs.writeFileSync(outputPath, icoBuffer);
	console.log(`Generated: ${outputPath} (ICO format)`);
}

async function main(): Promise<void> {
	console.log('Generating icons from SVG source...\n');

	// Ensure output directories exist
	if (!fs.existsSync(OUTPUT_DIR)) {
		fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	}
	if (!fs.existsSync(FAVICON_DIR)) {
		fs.mkdirSync(FAVICON_DIR, { recursive: true });
	}
	if (!fs.existsSync(INFO_DIR)) {
		fs.mkdirSync(INFO_DIR, { recursive: true });
	}

	// Check if source SVG exists
	if (!fs.existsSync(SOURCE_SVG)) {
		console.error(`Source SVG not found: ${SOURCE_SVG}`);
		process.exit(1);
	}

	// Generate manifest icons
	console.log('Generating manifest icons...');
	for (const size of MANIFEST_SIZES) {
		const outputPath = path.join(OUTPUT_DIR, `app_icon-${size}x${size}.png`);
		await generatePng(SOURCE_SVG, outputPath, size);
	}

	// Generate logo for info directory
	console.log('\nGenerating logo...');
	await generatePng(SOURCE_SVG, path.join(INFO_DIR, 'logo.png'), LOGO_SIZE);

	// Generate favicon
	console.log('\nGenerating favicon...');
	await generateFavicon(SOURCE_SVG, path.join(FAVICON_DIR, 'favicon.ico'));

	// Generate apple-touch-icon
	console.log('\nGenerating apple-touch-icon...');
	await generatePng(SOURCE_SVG, path.join(FAVICON_DIR, 'apple-touch-icon.png'), APPLE_TOUCH_ICON_SIZE);

	console.log('\nIcon generation complete!');
}

main().catch((err) => {
	console.error('Error generating icons:', err);
	process.exit(1);
});
