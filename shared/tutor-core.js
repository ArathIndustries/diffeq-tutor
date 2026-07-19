/**
 * TutorCore — Shared foundation for subject-specific tutor modules.
 * Provides: renderProblem, progress tracking, KaTeX integration.
 * Used by statics-tutor, diffeq-tutor, circuits-tutor, etc.
 */

const TutorCore = (() => {
  // Private: localStorage prefix for progress tracking
  let progressPrefix = 'tutor-';

  /**
   * renderProblem(problem, container, options)
   * Renders a full problem card from a problem object into the container.
   *
   * Problem schema:
   * {
   *   id: string,              // unique key (used in localStorage)
   *   section: string,         // '5.3', '2D', etc.
   *   num: number,             // problem number
   *   badge: string|null,      // optional badge label shown next to the title
   *   title: string,           // short label for TOC
   *   prompt: string,          // HTML with KaTeX
   *   reference: string|null,  // optional reference-box HTML
   *   steps: [
   *     { label: string, why: string|null, body: string },
   *     ...
   *   ],
   *   answer: string,          // HTML for answer-box
   * }
   *
   * Options:
   * {
   *   quizMode: boolean,  // start in quiz mode? (default: false)
   *   onComplete: fn,     // callback when marked complete
   * }
   */
  function renderProblem(problem, container, options = {}) {
    options = { quizMode: false, onComplete: null, ...options };

    const quizModeClass = options.quizMode ? ' quiz-active' : '';
    const badge = problem.badge
      ? `<span class="badge-label">${problem.badge}</span>`
      : '';

    const isComplete = isCompleteById(problem.id);
    const checkboxChecked = isComplete ? ' checked' : '';

    // Build the card HTML
    let cardHTML = `
      <div class="question-card${quizModeClass}" data-problem-id="${problem.id}" data-quiz-mode="${options.quizMode}">
        <h2>
          <div>
            Problem ${problem.section} #${problem.num}
            ${badge}
          </div>
          <div class="card-header-right">
            <label class="mark-complete-label">
              <input type="checkbox"${checkboxChecked} class="mark-complete-check">
              Done
            </label>
            <button class="quiz-toggle-btn" data-problem-id="${problem.id}">
              ${options.quizMode ? 'Study mode' : 'Quiz me'}
            </button>
          </div>
        </h2>

        <div class="problem-statement">
          ${problem.prompt}
        </div>
    `;

    // Reference box (optional)
    if (problem.reference) {
      cardHTML += `<div class="reference-box">${problem.reference}</div>`;
    }

    // Steps rendering
    cardHTML += '<ol class="steps-list">';
    problem.steps.forEach((step, idx) => {
      const stepId = `${problem.id}-step-${idx}`;
      const bodyClass = options.quizMode ? ' hidden' : '';
      const showBtn = options.quizMode
        ? `<button class="step-reveal-btn" data-step-id="${stepId}">Show step ${idx + 1} →</button>`
        : '';

      cardHTML += `
        <li class="step" data-step-index="${idx}">
          ${showBtn}
          <div class="step-label">${step.label}</div>
      `;

      if (step.why) {
        cardHTML += `<div class="why-box"><strong>Why:</strong> ${step.why}</div>`;
      }

      cardHTML += `
          <div class="step-body${bodyClass}" data-step-id="${stepId}">
            ${step.body}
          </div>
        </li>
      `;
    });
    cardHTML += '</ol>';

    // Answer box
    const answerClass = options.quizMode ? ' hidden' : '';
    cardHTML += `
      <div class="answer-box${answerClass}" data-problem-id="${problem.id}-answer">
        <span class="label">Final Answer:</span>
        ${problem.answer}
      </div>
    </div>
    `;

    // Inject into container
    const div = document.createElement('div');
    div.innerHTML = cardHTML;
    const card = div.firstElementChild;
    container.appendChild(card);

    // Bind events
    bindCardEvents(card, problem, options);

    // Render KaTeX in the card
    renderMathInElement(card, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
      ],
    });

    return card;
  }

  /**
   * Private: bind all event listeners for a card
   */
  function bindCardEvents(card, problem, options) {
    const problemId = problem.id;
    const quizToggleBtn = card.querySelector('.quiz-toggle-btn');
    const markCompleteCheck = card.querySelector('.mark-complete-check');
    const revealBtns = card.querySelectorAll('.step-reveal-btn');
    const answerBox = card.querySelector('[data-problem-id="' + problemId + '-answer' + '"]');

    // Quiz mode toggle
    if (quizToggleBtn) {
      quizToggleBtn.addEventListener('click', () => {
        const isQuiz = card.classList.toggle('quiz-active');
        quizToggleBtn.textContent = isQuiz ? 'Study mode' : 'Quiz me';

        // Hide/show all steps and answer
        const steps = card.querySelectorAll('.step-body');
        const ansBox = card.querySelector('[data-problem-id="' + problemId + '-answer' + '"]');

        steps.forEach((step) => {
          step.classList.toggle('hidden');
        });
        ansBox.classList.toggle('hidden');

        // Reset step reveal buttons visibility
        revealBtns.forEach((btn) => {
          btn.style.display = isQuiz ? 'inline' : 'none';
        });
      });
    }

    // Step reveal buttons (quiz mode)
    revealBtns.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        const step = card.querySelectorAll('.step')[idx];
        const body = step.querySelector('.step-body');
        body.classList.remove('hidden');

        // Show next reveal button if available
        const nextBtn = revealBtns[idx + 1];
        if (nextBtn) {
          nextBtn.style.display = 'inline';
        } else if (answerBox) {
          // All steps revealed — show "Show Answer" text before the answer box
          answerBox.style.display = 'block';
        }

        btn.remove(); // Remove this button
      });

      // Initially hide step bodies and their buttons in quiz mode
      if (card.classList.contains('quiz-active')) {
        btn.style.display = idx === 0 ? 'inline' : 'none';
        const step = card.querySelectorAll('.step')[idx];
        const body = step.querySelector('.step-body');
        body.classList.add('hidden');
      }
    });

    // Mark complete checkbox
    if (markCompleteCheck) {
      markCompleteCheck.addEventListener('change', () => {
        markComplete(problemId, markCompleteCheck.checked);
        if (options.onComplete) {
          options.onComplete(problemId, markCompleteCheck.checked);
        }
      });
    }
  }

  /**
   * markComplete(id, bool) — save completion state to localStorage
   */
  function markComplete(id, isComplete) {
    const key = progressPrefix + id;
    if (isComplete) {
      localStorage.setItem(key, 'true');
    } else {
      localStorage.removeItem(key);
    }
  }

  /**
   * isCompleteById(id) — check if a problem is marked complete
   */
  function isCompleteById(id) {
    return localStorage.getItem(progressPrefix + id) === 'true';
  }

  /**
   * getProgress(ids) — returns { done, total }
   */
  function getProgress(ids) {
    const done = ids.filter((id) => isCompleteById(id)).length;
    return { done, total: ids.length };
  }

  /**
   * updateProgress(progressEl, ids) — update progress bar + text
   */
  function updateProgress(progressEl, ids) {
    const { done, total } = getProgress(ids);
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const fill = progressEl.querySelector('.progress-fill');
    const text = progressEl.querySelector('.progress-text');
    if (fill) fill.style.width = pct + '%';
    if (text) text.innerHTML = `<span>${done} / ${total} complete</span><span>${pct}%</span>`;
  }

  /**
   * updateTOC(ids) — inject ✓ marks into TOC anchors
   */
  function updateTOC(ids) {
    const toc = document.querySelector('.toc');
    if (!toc) return;

    ids.forEach((id) => {
      const link = toc.querySelector(`a[href="#${id}"]`);
      if (link) {
        // Remove old check
        const oldCheck = link.querySelector('.toc-check');
        if (oldCheck) oldCheck.remove();

        // Add new check if complete
        if (isCompleteById(id)) {
          const check = document.createElement('span');
          check.className = 'toc-check';
          check.textContent = '✓ ';
          link.insertBefore(check, link.firstChild);
        }
      }
    });
  }

  /**
   * resetProgress(prefix) — clear all localStorage keys matching prefix
   */
  function resetProgress(prefix) {
    prefix = prefix || progressPrefix;
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
    keys.forEach((k) => localStorage.removeItem(k));
  }

  /**
   * setProgressPrefix(newPrefix) — set the localStorage key prefix (default: 'tutor-')
   */
  function setProgressPrefix(newPrefix) {
    progressPrefix = newPrefix;
  }

  // Public API
  return {
    renderProblem,
    markComplete,
    isCompleteById,
    getProgress,
    updateProgress,
    updateTOC,
    resetProgress,
    setProgressPrefix,
  };
})();

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TutorCore;
}
