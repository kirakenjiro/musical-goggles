/* pages/scripts.js
────────────────────────────────────────────────────────
Client‑side logic for Scent Psych quiz:
• Handles quiz navigation (intro → questions → results)
• Captures slider input, performs soft‑snap (1–10)
• Stores answers
• Simulates AI endpoint call (replace with actual fetch)
• Renders results dynamically
• Handles quiz reset
*/

// --- IMPORTANT NOTE ON CORS & LOCAL FILES ---
// You mentioned seeing a CORS error when running from `file:///`.
// This is expected browser security behavior. `fetch` requests (like
// the one we'll use for the AI endpoint) are blocked when the
// HTML page is loaded directly from your local filesystem.
//
// TO FIX THIS DURING DEVELOPMENT:
// You MUST serve these files (index.html, styles.css, scripts.js)
// from a local web server. Simple options include:
//   - VS Code's "Live Server" extension
//   - Node.js: `npx http-server pages/` (run in parent directory)
//   - Python: `python -m http.server` (run inside the `pages` directory)
// Access the quiz via `http://localhost:PORT` (e.g., http://localhost:8080).
//
// FOR PRODUCTION AI CALLS:
// The *Puter AI endpoint server* must be configured to send the correct
// CORS headers (e.g., `Access-Control-Allow-Origin: YOUR_WEBSITE_DOMAIN`)
// to allow your frontend JavaScript to successfully call it from the browser.
// This script CANNOT force the server to accept the request.
// ---

document.addEventListener("DOMContentLoaded", () => {
	// --- DOM Element References ---
	const introScreen = document.getElementById("intro");
	const quizForm = document.getElementById("quizForm");
	const resultsScreen = document.getElementById("results");
	const startBtn = document.getElementById("startBtn");
	const questions = quizForm.querySelectorAll(".question");
	const sliders = quizForm.querySelectorAll('input[type="range"]');
	const prevBtn = document.getElementById("prevBtn");
	const nextBtn = document.getElementById("nextBtn");
	const submitBtn = document.getElementById("submitBtn");
	const progressBarFill = document.getElementById("progressFill");
	const resultContainer = document.getElementById("resultContainer");
	const restartBtn = document.getElementById("restartBtn");

	// --- Quiz State ---
	let currentQuestionIndex = 0;
	const totalQuestions = questions.length;
	const userAnswers = {}; // { q1: 5, q2: 8, ... }

	// --- Functions ---

	/** Initializes the quiz, hiding intro and showing the first question */
	function startQuiz() {
		introScreen.classList.add("hidden");
		quizForm.classList.remove("hidden");
		resultsScreen.classList.add("hidden");
		currentQuestionIndex = 0;
		showQuestion(currentQuestionIndex);
		updateProgress();
		// Initialize answers with default slider values (rounded)
		sliders.forEach((slider, index) => {
			const questionId = `q${index + 1}`;
			userAnswers[questionId] = softSnapValue(slider.value);
		});
	}

	/** Hides all questions and shows the one at the specified index */
	function showQuestion(index) {
		questions.forEach((q, i) => {
			q.classList.toggle("hidden", i !== index);
		});
		updateNavigationButtons();
		updateProgress();
	}

	/** Calculates the 1-10 bucket value from the raw 1-100 slider value */
	function softSnapValue(rawValue) {
		const value = parseInt(rawValue, 10);
		let bucket = Math.round(value / 10); // Rounds to nearest 0-10
		if (bucket < 1) bucket = 1; // Clamp to 1-10 range
		if (bucket > 10) bucket = 10;
		return bucket;
	}

	/** Updates the stored answer when a slider changes */
	function handleSliderInput(event) {
		const slider = event.target;
		const questionDiv = slider.closest(".question");
		if (!questionDiv) return;

		const questionIndex = parseInt(questionDiv.dataset.q, 10); // Get q number (1-10)
		const questionId = `q${questionIndex}`;
		const snappedValue = softSnapValue(slider.value);

		userAnswers[questionId] = snappedValue;
		// console.log(`Answered ${questionId}: ${snappedValue} (raw: ${slider.value})`); // For debugging
	}

	/** Shows/hides navigation buttons based on current question */
	function updateNavigationButtons() {
		prevBtn.classList.toggle("hidden", currentQuestionIndex === 0);
		nextBtn.classList.toggle(
			"hidden",
			currentQuestionIndex === totalQuestions - 1
		);
		submitBtn.classList.toggle(
			"hidden",
			currentQuestionIndex !== totalQuestions - 1
		);
	}

	/** Updates the width of the progress bar */
	function updateProgress() {
		const progressPercent =
			((currentQuestionIndex + 1) / totalQuestions) * 100;
		progressBarFill.style.width = `${progressPercent}%`;
	}

	/** Moves to the next question */
	function nextQuestion() {
		if (currentQuestionIndex < totalQuestions - 1) {
			currentQuestionIndex++;
			showQuestion(currentQuestionIndex);
		}
	}

	/** Moves to the previous question */
	function prevQuestion() {
		if (currentQuestionIndex > 0) {
			currentQuestionIndex--;
			showQuestion(currentQuestionIndex);
		}
	}

	/** Submits answers to the AI endpoint and displays results */
	async function submitQuiz(event) {
		event.preventDefault(); // Prevent default form submission
		console.log("Submitting answers:", userAnswers);

		// Show loading state
		quizForm.classList.add("hidden");
		resultsScreen.classList.remove("hidden");
		resultContainer.innerHTML = "<p>Analyzing your scent profile...</p>"; // Loading message

		// --- AI Endpoint Call ---
		// NOTE: This assumes the Puter AI endpoint expects a POST request
		// with a JSON body containing the user's answers. You MAY need to
		// also send the products.json data if the AI needs it directly,
		// but ideally, the AI knows the products or you filter client-side.

		try {
			const productResponse = await fetch("../data/products.json"); // Fetch local product data
			if (!productResponse.ok)
				throw new Error("Failed to load product data");
			const productsData = await productResponse.json();

			let payload = {
				inventory: productsData, // Send product data along
				answers: userAnswers,
			};

			const prompt = `
        # Fragrance Recommendation Assistant

        You are a sophisticated AI perfume consultant that recommends fragrances based on users' sensory and lifestyle preferences. Your expertise helps match people with their ideal scents through an intuitive visual-preference system.

        ## Assessment System

        You analyze responses to visual-preference questions (rated 1-10) that subtly reveal fragrance preferences:

        | Question Category | Visual Scale | What This Reveals |
        |-------------------|--------------|-------------------|
        | **Seasonal Comfort** | Cool blues (1) → Warm oranges (10) | Temperature preference, seasonal scent inclination |
        | **Time of Day Energy** | Dawn lavenders (1) → Noon yellows (5) → Dusk purples (10) | Fresh vs heavy scent preference |
        | **Comfort Environment** | Forest greens (1) → Ocean blues (4) → Urban grays (7) → Mountain browns (10) | Natural vs synthetic scent affinity |
        | **Emotional Response to Rain** | Cozy indoors browns (1) → Dancing in rain blues (10) | Aquatic vs woody note preference |
        | **Memory Trigger** | Fresh laundry whites (1) → Garden pastels (5) → Old leather browns (10) | Clean vs complex scent structure |
        | **Social Energy** | Quiet library muted tones (1) → Café earth tones (5) → Party vibrant colors (10) | Subtle vs statement fragrance preference |
        | **Nature Connection** | Citrus grove yellows/greens (1) → Flower garden pinks/purples (5) → Forest floor browns/greens (10) | Fresh vs earthy note preference |
        | **Texture Association** | Silk pastels (1) → Cotton whites (4) → Leather browns (7) → Velvet jewel tones (10) | Scent sophistication level |
        | **Evening Relaxation** | Warm bath blues (1) → Garden stargazing deep blues (5) → Fireside oranges (10) | Sweet vs smoky preference |
        | **Adventure Scenario** | Mountain hiking greens (1) → Beach exploring blues (5) → City wandering grays (10) | Fresh vs complex environmental preference |

        ## Recommendation Process

        1. **Analyze** the user's numerical responses (1-10) for each question
        2. **Interpret** these values to create a comprehensive scent profile
        3. **Match** this profile with fragrances from the provided inventory
        4. **Suggest** 4 primary recommendations from your inventory
        5. **Add** 2 "wildcard" suggestions from outside your inventory (other brands)

        ## Response Format

        Deliver recommendations in JSON format, without including any markdown extras:

        {
          "profileName": "[Descriptive name of user's scent profile]",
          "matches": [
            {
              "name": "[Product name with code]",
              "manufacturer": "[Brand name]",
              "description": "[Detailed fragrance description with notes and character]"
            },
            // Additional matches (4 total)
          ],
          "wildcards": [
            {
              "name": "[Product name]",
              "manufacturer": "[Brand name outside inventory]",
              "description": "[Compelling description of why this matches their profile]"
            },
            // Second wildcard recommendation
          ]
        }

        The JSON data provided below contains two key elements:

        ${JSON.stringify(payload)}

        Our complete fragrance inventory with detailed product information
        The user's numerical responses (1-10) to each preference assessment question
        Use the users responses and provided inventory to create personalized, thoughtful recommendations that reflect their sensory preferences and lifestyle. 
      `;

			try {
				let response = await puter.ai.chat(prompt, {
					model: "gpt-4o",
				});

				displayResults(JSON.parse(response.message.content));
			} catch (error) {
				console.error("Error submitting quiz to AI:", error);
				resultContainer.innerHTML = `<p>Sorry, couldn't get recommendations. Error: ${error.message}</p>`;
				// Provide more user-friendly error handling if needed
			}
		} catch (error) {
			console.error("Error loading product data:", error);
			resultContainer.innerHTML =
				"<p>Error loading product data. Cannot get recommendations.</p>";
			return; // Stop submission
		}
	}

	/** Renders the results from the AI */
	function displayResults(data) {
		// --- EXAMPLE STRUCTURE ---
		// Assuming the AI returns data like:
		// {
		//   "profileName": "Fresh Herbal Woods",
		//   "matches": [
		//     { "name": "598 - Inspired by Mont Blanc", "manufacturer": "The Scent Reserve", "description": "598 embodies the rugged, pristine beauty of mountainous terrains, blending crisp air and woody scents. It opens with crisp bergamot and clary sage, follows with a heart of pink pepper and vetiver, and finishes with a base of leather and oakmoss, offering a robust, earthy fragrance suited for the adventurous." },
		//     { "name": "149 - Inspired by Baccarat Rouge 540", "manufacturer": "The Scent Reserve", "description": "149 is a woody scent that captures a captivating alchemy. Its highly concentrated and graphic signature is composed of breezy jasmine facets, radiant saffron, and ambergris mineral notes that enhance the woody tones of freshly-cut cedar. The bright and sleek fragrance caresses the skin with a delicate amber and woody floral whisper." }
		//   ],
		//   "wildcards": [
		//     { "name": "Blossom", "manufacturer": "Jimmy Choo", "description": "A bold bouquet for bright young party girls." }
		//   ]
		// }
		// --- Adjust parsing based on your ACTUAL AI response format ---

		console.log(data);

		let html = `<h2>Your Scent Profile: <strong>${
			data.profileName || "Unique Blend"
		}</strong></h2>`;

		// Todo: Add in image caching for the scent reserve library.
		// <img src="${product.image || "placeholder.png"}" alt="${
		//   product.name
		// }">

		if (data.matches && data.matches.length > 0) {
			html += '<h3>Top Matches:</h3><div class="resultGrid">';
			data.matches.forEach((product) => {
				html += `
                <div class="resultCard">
                <h4>${product.name || "Unnamed Scent"}</h4>
                <p>${product.description || ""}</p>
                </div>
            `;
			});
			html += "</div>";
		} else {
			html +=
				"<p>We found some interesting possibilities, but no perfect matches in our current collection.</p>";
		}

		if (data.wildcards && data.wildcards.length > 0) {
			html +=
				'<h3>Feeling Adventurous? Try These:</h3><div class="resultGrid">';
			data.wildcards.forEach((product) => {
				html += `
                <div class="resultCard">
                <h4>${product.name || "Unnamed Scent"}</h4>
                <p>${product.description || ""}</p>
                </div>
            `;
			});
			html += "</div>";
		}

		resultContainer.innerHTML = html;
	}

	/** Resets the quiz back to the intro screen */
	function resetQuiz() {
		Object.keys(userAnswers).forEach((key) => delete userAnswers[key]); // Clear answers
		sliders.forEach((slider) => (slider.value = 50)); // Reset sliders visually
		introScreen.classList.remove("hidden");
		quizForm.classList.add("hidden");
		resultsScreen.classList.add("hidden");
		currentQuestionIndex = 0; // Reset index
		// No need to call showQuestion as the form is hidden
	}

	// --- Event Listeners ---
	startBtn.addEventListener("click", startQuiz);
	prevBtn.addEventListener("click", prevQuestion);
	nextBtn.addEventListener("click", nextQuestion);
	quizForm.addEventListener("submit", submitQuiz); // Handles the final submit button
	restartBtn.addEventListener("click", resetQuiz);

	// Add input listeners to all sliders for real-time answer updates
	sliders.forEach((slider) => {
		// Use 'input' for immediate feedback while dragging
		slider.addEventListener("input", handleSliderInput);
		// Use 'change' as a fallback / for final value capture if needed, though 'input' is usually sufficient
		// slider.addEventListener('change', handleSliderInput);
	});

	// --- Initial Setup ---
	// Ensure quiz and results are hidden initially (CSS might already do this)
	quizForm.classList.add("hidden");
	resultsScreen.classList.add("hidden");
}); // End DOMContentLoaded
