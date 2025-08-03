// Test script to explore available icons
const icons = require("@lobehub/icons");

console.log("Available icons:");
console.log(Object.keys(icons));

// Look for specific AI model icons
const aiModels = [
	"Claude",
	"Gemini",
	"OpenAI",
	"Grok",
	"Anthropic",
	"Google",
	"xAI",
];
aiModels.forEach((model) => {
	const found = Object.keys(icons).filter((icon) =>
		icon.toLowerCase().includes(model.toLowerCase()),
	);
	if (found.length > 0) {
		console.log(`${model} icons:`, found);
	}
});
