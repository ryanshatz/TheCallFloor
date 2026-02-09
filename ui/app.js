/**
 * Call Center Tycoon - Enhanced UI with Tutorial & Broke Recovery
 */

import { Game } from '../src/Game.js';

// Tutorial Steps Configuration
const TUTORIAL_STEPS = [
    {
        id: 'welcome',
        icon: '📞',
        title: 'Welcome to Call Center Tycoon!',
        text: 'You\'re about to build your outbound call center empire from the ground up. Let\'s learn the basics!',
        highlight: null,
        action: null
    },
    {
        id: 'play-button',
        icon: '▶️',
        title: 'Start Your Shift',
        text: 'Click the <strong>Play button</strong> to start the simulation. Your agents will begin dialing leads automatically.',
        highlight: '#btn-play',
        action: 'play'
    },
    {
        id: 'agents',
        icon: '👥',
        title: 'Your Agent Team',
        text: 'This panel shows your agents. Watch their <strong>status change</strong> as they dial, talk to prospects, and wrap up calls. Each agent has unique stats!',
        highlight: '.agent-list',
        action: null
    },
    {
        id: 'metrics',
        icon: '📊',
        title: 'Performance Dashboard',
        text: 'Track your KPIs here: <strong>Dials, Contacts, Conversions</strong>, and Revenue. Contact Rate and Conversion Rate show how effective your operation is.',
        highlight: '.metrics-grid',
        action: null
    },
    {
        id: 'dialer',
        icon: '📱',
        title: 'Dialer Technology',
        text: 'Better dialers = more dials per minute! Start with <strong>Manual</strong>, then unlock Power, Progressive, and Predictive as you grow.',
        highlight: '.dialer-grid',
        action: null
    },
    {
        id: 'upgrades',
        icon: '⬆️',
        title: 'Upgrades & Growth',
        text: 'Spend your profits on <strong>upgrades</strong>: hire agents, buy leads, improve training, and boost your caller ID reputation!',
        highlight: '.upgrade-list',
        action: null
    },
    {
        id: 'leads',
        icon: '📋',
        title: 'Lead Management',
        text: 'You need <strong>leads to dial</strong>! Buy lead batches from the upgrades panel. If you run out of money, you can claim free emergency leads.',
        highlight: '.lead-stats',
        action: null
    },
    {
        id: 'complete',
        icon: '🎉',
        title: 'You\'re Ready!',
        text: 'That\'s the basics! <strong>Click Play</strong>, watch the metrics, reinvest in upgrades, and build the biggest call center in the business. Good luck!',
        highlight: null,
        action: null
    }
];

class GameUI {
    constructor() {
        this.game = null;
        this.selectedAgentId = null;
        this.upgradeCategory = 'all';
        this.activityLog = [];
        this.maxLogEntries = 50;
        this.lastLogCount = 0; // Track for animation

        // Tutorial state
        this.tutorialActive = false;
        this.tutorialStep = 0;
        this.hasSeenTutorial = false;

        // Broke state
        this.brokeWarningShown = false;
        this.freeLeadsCooldown = 0;

        // Startup state
        this.gameStarted = false;
    }

    async init() {
        try {
            // Check if there's a save before showing startup modal
            const hasSave = this.checkForSave();

            // Show startup modal
            this.showStartupModal(hasSave);

            console.log('🎮 Call Center Tycoon ready');
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showNotification('error', 'Error', 'Failed to load. Check console.');
        }
    }

    checkForSave() {
        const saveData = localStorage.getItem('callCenterTycoon_save');
        if (!saveData) return null;

        try {
            const parsed = JSON.parse(saveData);
            return {
                day: parsed.gameTime?.day || 1,
                cash: parsed.cash || 0,
                agents: parsed.agents?.length || 0,
                savedAt: parsed.savedAt ? new Date(parsed.savedAt) : null
            };
        } catch (e) {
            return null;
        }
    }

    showStartupModal(saveInfo) {
        const overlay = document.getElementById('startup-overlay');
        const continueBtn = document.getElementById('startup-continue');
        const newBtn = document.getElementById('startup-new');
        const saveInfoEl = document.getElementById('save-info');

        if (!overlay) return;

        // Show/hide continue option based on save
        if (saveInfo && continueBtn) {
            continueBtn.style.display = 'flex';
            if (saveInfoEl) {
                const timeAgo = saveInfo.savedAt ? this.formatTimeAgo(saveInfo.savedAt) : 'Unknown';
                saveInfoEl.textContent = `Day ${saveInfo.day} • $${saveInfo.cash.toLocaleString()} • ${saveInfo.agents} agents • ${timeAgo}`;
            }
        }

        // Bind click handlers
        continueBtn?.addEventListener('click', () => this.startGame(true));
        newBtn?.addEventListener('click', () => this.startGame(false));

        // Show the modal
        overlay.classList.remove('hidden');
    }

    formatTimeAgo(date) {
        const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    async startGame(loadSave = false) {
        // Hide startup modal
        const overlay = document.getElementById('startup-overlay');
        if (overlay) overlay.classList.add('hidden');

        // If starting new, clear the save
        if (!loadSave) {
            localStorage.removeItem('callCenterTycoon_save');
            localStorage.removeItem('cct_tutorial_complete');
        }

        // Initialize the game
        this.game = new Game();
        await this.game.init();
        this.gameStarted = true;

        this.bindEvents();
        this.setupCallbacks();
        this.render();
        this.startRenderLoop();

        this.addLog('info', loadSave ? 'Welcome back, Manager!' : 'Welcome to Call Center Tycoon!', '🎮');

        // Check tutorial for new games
        this.hasSeenTutorial = localStorage.getItem('cct_tutorial_complete') === 'true';
        if (!this.hasSeenTutorial && !loadSave) {
            setTimeout(() => this.startTutorial(), 500);
        }
    }


    bindEvents() {
        // Game controls
        document.getElementById('btn-play')?.addEventListener('click', () => this.togglePlay());
        document.getElementById('btn-sim-day')?.addEventListener('click', () => this.simulateDay());
        document.getElementById('btn-reset')?.addEventListener('click', () => this.resetGame());
        document.getElementById('btn-tutorial')?.addEventListener('click', () => this.startTutorial());

        // Speed buttons
        document.querySelectorAll('[data-speed]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const speed = parseInt(e.currentTarget.dataset.speed);
                this.setSpeed(speed);
            });
        });

        // Tutorial controls
        document.getElementById('tutorial-next')?.addEventListener('click', () => this.nextTutorialStep());
        document.getElementById('tutorial-skip')?.addEventListener('click', () => this.endTutorial());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Setup tooltips with proper positioning
        this.setupTooltips();
    }

    setupTooltips() {
        document.querySelectorAll('.tooltip-container').forEach(container => {
            const trigger = container.querySelector('.tooltip-trigger');
            const content = container.querySelector('.tooltip-content');

            if (!trigger || !content) return;

            trigger.addEventListener('mouseenter', () => {
                const rect = trigger.getBoundingClientRect();
                const contentWidth = 250;

                // Position above and centered, but keep in viewport
                let left = rect.left + rect.width / 2 - contentWidth / 2;
                let top = rect.top - 10;

                // Keep in viewport horizontally
                if (left < 10) left = 10;
                if (left + contentWidth > window.innerWidth - 10) {
                    left = window.innerWidth - contentWidth - 10;
                }

                content.style.left = left + 'px';
                content.style.top = 'auto';
                content.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
                content.style.width = contentWidth + 'px';
            });
        });
    }

    handleKeyboard(e) {
        if (e.code === 'Space' && !e.target.matches('input, textarea')) {
            e.preventDefault();
            this.togglePlay();
        }
        if (e.code === 'Escape' && this.tutorialActive) {
            this.endTutorial();
        }
    }

    setupCallbacks() {
        this.game.engine.on('onConversion', ({ agent, lead, revenue }) => {
            this.addLog('conversion', `${agent.name} closed a sale!`, `+$${revenue}`);
            this.showNotification('success', 'Conversion!', `${agent.name} earned $${revenue}`);
        });

        this.game.engine.on('onMinute', () => {
            this.updateMetrics();
            this.updateTime();
            this.updateLiveStats();
            this.checkBrokeState();
        });
    }

    // ==================== BROKE STATE RECOVERY ====================

    checkBrokeState() {
        const state = this.game.state;
        const leads = state.leadPool.getStats();
        const canAffordLeads = state.cash >= 50; // Cheapest lead batch

        // Decrease cooldown
        if (this.freeLeadsCooldown > 0) {
            this.freeLeadsCooldown--;
        }

        // Check if player is stuck
        if (leads.dialable < 5 && !canAffordLeads && !this.brokeWarningShown) {
            this.brokeWarningShown = true;
            this.showNotification('warning', 'Low on Leads!', 'Claim free emergency leads to keep going.');
        }

        // Reset warning when recovered
        if (canAffordLeads || leads.dialable >= 10) {
            this.brokeWarningShown = false;
        }
    }

    claimFreeLeads() {
        if (this.freeLeadsCooldown > 0) {
            this.showNotification('warning', 'Cooldown Active', `Wait ${Math.ceil(this.freeLeadsCooldown / 60)} more minutes`);
            return;
        }

        // Generate 25 free leads of lower quality
        const freeSource = this.game.state.leadPool.sources.get('standard_leads');
        if (freeSource) {
            freeSource.unlocked = true;
            this.game.state.leadPool.generateLeads('standard_leads', 25, () => this.game.engine.rng.random());
            this.freeLeadsCooldown = 300; // 5 minute cooldown (in game ticks)
            this.addLog('info', 'Claimed 25 emergency leads!', '🆘');
            this.showNotification('success', 'Emergency Leads', 'Added 25 free leads to your pool');
            this.render();
        }
    }

    // ==================== TUTORIAL ====================

    startTutorial() {
        this.tutorialActive = true;
        this.tutorialStep = 0;
        this.showTutorialStep();
        document.getElementById('tutorial-overlay')?.classList.add('active');
    }

    showTutorialStep() {
        const step = TUTORIAL_STEPS[this.tutorialStep];
        if (!step) return;

        // Update tutorial card content
        const iconEl = document.getElementById('tutorial-icon');
        const titleEl = document.getElementById('tutorial-title');
        const textEl = document.getElementById('tutorial-text');

        if (iconEl) iconEl.textContent = step.icon;
        if (titleEl) titleEl.textContent = step.title;
        if (textEl) textEl.innerHTML = step.text;

        // Update progress dots
        document.querySelectorAll('.tutorial-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === this.tutorialStep);
            dot.classList.toggle('completed', i < this.tutorialStep);
        });

        // Update button text
        const nextBtn = document.getElementById('tutorial-next');
        if (nextBtn) {
            nextBtn.textContent = this.tutorialStep === TUTORIAL_STEPS.length - 1 ? 'Start Playing!' : 'Next →';
        }

        // Handle spotlight
        this.updateSpotlight(step.highlight);
    }

    updateSpotlight(selector) {
        let spotlight = document.getElementById('tutorial-spotlight');

        if (!selector) {
            if (spotlight) spotlight.style.display = 'none';
            return;
        }

        const target = document.querySelector(selector);
        if (!target) {
            if (spotlight) spotlight.style.display = 'none';
            return;
        }

        if (!spotlight) {
            spotlight = document.createElement('div');
            spotlight.id = 'tutorial-spotlight';
            spotlight.className = 'tutorial-spotlight';
            document.body.appendChild(spotlight);
        }

        const rect = target.getBoundingClientRect();
        const padding = 8;
        spotlight.style.display = 'block';
        spotlight.style.top = `${rect.top - padding}px`;
        spotlight.style.left = `${rect.left - padding}px`;
        spotlight.style.width = `${rect.width + padding * 2}px`;
        spotlight.style.height = `${rect.height + padding * 2}px`;
    }

    nextTutorialStep() {
        const currentStep = TUTORIAL_STEPS[this.tutorialStep];

        // Handle step-specific actions
        if (currentStep.action === 'play' && !this.game.isRunning) {
            this.togglePlay();
        }

        this.tutorialStep++;

        if (this.tutorialStep >= TUTORIAL_STEPS.length) {
            this.endTutorial();
        } else {
            this.showTutorialStep();
        }
    }

    endTutorial() {
        this.tutorialActive = false;
        localStorage.setItem('cct_tutorial_complete', 'true');
        document.getElementById('tutorial-overlay')?.classList.remove('active');

        const spotlight = document.getElementById('tutorial-spotlight');
        if (spotlight) spotlight.style.display = 'none';

        this.addLog('info', 'Tutorial complete! Good luck, Manager!', '🎓');
    }

    // ==================== NOTIFICATIONS ====================

    showNotification(type, title, message) {
        const container = document.getElementById('notification-container');
        if (!container) return;

        const icons = {
            success: '✅',
            warning: '⚠️',
            error: '❌',
            info: 'ℹ️'
        };

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${icons[type]}</span>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <div class="notification-message">${message}</div>
            </div>
        `;

        container.appendChild(notification);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    // ==================== GAME CONTROLS ====================

    togglePlay() {
        if (this.game.isRunning) {
            this.game.pause();
            document.getElementById('btn-play').textContent = '▶️';
            this.addLog('info', 'Simulation paused', '⏸️');
        } else {
            this.game.start();
            document.getElementById('btn-play').textContent = '⏸️';
            this.addLog('info', 'Agents are on the phones!', '📞');
        }
    }

    setSpeed(multiplier) {
        this.game.setSpeed(multiplier);
        document.querySelectorAll('[data-speed]').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.speed) === multiplier);
        });
        this.addLog('info', `Speed set to ${multiplier}x`, '⏩');
    }

    simulateDay() {
        if (!confirm('Simulate the rest of the day? This will fast-forward to end of shift.')) return;

        const results = this.game.simulateDay();
        this.addLog('info', `Day ${this.game.state.gameTime.day - 1} complete!`, '📅');
        this.showNotification(
            results.profit >= 0 ? 'success' : 'warning',
            'End of Day Report',
            `Revenue: $${results.revenue} | Costs: $${results.costs} | Profit: $${results.profit}`
        );
        this.render();
    }

    resetGame() {
        if (!confirm('Reset all progress? This cannot be undone!')) return;

        this.game.resetGame();
        this.activityLog = [];
        this.lastLogCount = 0;
        localStorage.removeItem('cct_tutorial_complete');
        this.hasSeenTutorial = false;
        this.brokeWarningShown = false;
        this.freeLeadsCooldown = 0;
        this.render();
        this.showNotification('info', 'Game Reset', 'Starting fresh!');
        setTimeout(() => this.startTutorial(), 500);
    }

    // ==================== LOGGING ====================

    addLog(type, message, extra = '') {
        const gt = this.game.state.gameTime;
        const time = `${String(gt.hour).padStart(2, '0')}:${String(gt.minute).padStart(2, '0')}`;
        this.activityLog.unshift({ type, message, extra, time, isNew: true });

        if (this.activityLog.length > this.maxLogEntries) {
            this.activityLog.pop();
        }

        this.renderActivityLog();

        // Mark as not new after animation completes
        setTimeout(() => {
            if (this.activityLog[0]) {
                this.activityLog[0].isNew = false;
            }
        }, 350);
    }

    // ==================== RENDERING ====================

    render() {
        this.renderHeader();
        this.renderAgents();
        this.renderMetrics();
        this.renderTime();
        this.renderDialers();
        this.renderUpgrades();
        this.renderActivityLog();
        this.renderLeadStats();
        this.updateLiveStats();
    }

    renderHeader() {
        const cash = document.getElementById('cash-display');
        const agents = document.getElementById('agent-count');
        const reputation = document.getElementById('reputation-display');

        if (cash) cash.textContent = this.formatMoney(this.game.state.cash);
        if (agents) agents.textContent = this.game.state.agents.length;
        if (reputation) reputation.textContent = Math.round(this.game.state.reputation);
    }

    renderAgents() {
        const container = document.getElementById('agent-list');
        if (!container) return;

        if (this.game.state.agents.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">No agents hired yet</div></div>';
            return;
        }

        container.innerHTML = this.game.state.agents.map(agent => {
            const initials = agent.name.split(' ').map(n => n[0]).join('');

            return `
                <div class="agent-card state-${agent.state} ${agent.id === this.selectedAgentId ? 'selected' : ''}" 
                     data-agent-id="${agent.id}"
                     onclick="window.gameUI.selectAgent('${agent.id}')">
                    <div class="agent-header">
                        <div class="agent-avatar">${initials}</div>
                        <div class="agent-info">
                            <div class="agent-name">${agent.name}</div>
                            <span class="agent-state ${agent.state}">${this.formatState(agent.state)}</span>
                        </div>
                    </div>
                    <div class="agent-metrics">
                        <span>🎯 ${(agent.skillTalktrack * 100).toFixed(0)}%</span>
                        <span>⚡ ${(agent.speedWrapup * 100).toFixed(0)}%</span>
                        <span>📞 ${agent.dailyStats.contacts}</span>
                        <span>💰 ${agent.dailyStats.conversions}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderMetrics() {
        const metrics = this.game.getMetrics();

        this.updateMetricCard('dials', metrics.dials);
        this.updateMetricCard('contacts', metrics.contacts);
        this.updateMetricCard('conversions', metrics.conversions);
        this.updateMetricCard('contact-rate', metrics.contactRate);
        this.updateMetricCard('conversion-rate', metrics.conversionRate);
        this.updateMetricCard('revenue', '$' + this.formatMoney(metrics.revenue));
        this.updateMetricCard('costs', '$' + this.formatMoney(metrics.costs));
        this.updateMetricCard('profit', '$' + this.formatMoney(metrics.profit), metrics.profit >= 0);
    }

    updateMetricCard(id, value, isPositive = true) {
        const el = document.getElementById(`metric-${id}`);
        if (el) {
            el.textContent = value;
            if (id === 'profit') {
                el.classList.toggle('positive', isPositive);
                el.classList.toggle('negative', !isPositive);
            }
        }
    }

    updateLiveStats() {
        const agents = this.game.state.agents;
        const dialing = agents.filter(a => a.state === 'dialing').length;
        const onCall = agents.filter(a => a.state === 'on_call').length;
        const wrapup = agents.filter(a => a.state === 'wrap_up').length;

        const dialingEl = document.getElementById('live-dialing');
        const talkingEl = document.getElementById('live-talking');
        const wrapupEl = document.getElementById('live-wrapup');

        if (dialingEl) dialingEl.textContent = dialing;
        if (talkingEl) talkingEl.textContent = onCall;
        if (wrapupEl) wrapupEl.textContent = wrapup;
    }

    renderTime() {
        const clock = document.getElementById('time-clock');
        const day = document.getElementById('time-day');
        const status = document.getElementById('time-status');

        const gt = this.game.state.gameTime;
        if (clock) clock.textContent = `${String(gt.hour).padStart(2, '0')}:${String(gt.minute).padStart(2, '0')}`;
        if (day) day.textContent = `Day ${gt.day}`;
        if (status) {
            const isOpen = this.game.state.isWorkHours();
            status.textContent = isOpen ? 'Shift Active' : 'After Hours';
            status.className = `time-status ${isOpen ? 'active' : 'closed'}`;
        }
    }

    renderDialers() {
        const container = document.getElementById('dialer-list');
        if (!container) return;

        const dialers = this.game.getDialers();
        const activeId = this.game.state.dialerManager.activeDialerId;

        const dialerIcons = {
            manual: '☎️',
            power: '📱',
            progressive: '📲',
            predictive: '🔮',
            ai_assisted: '🤖'
        };

        container.innerHTML = dialers.map(dialer => `
            <div class="dialer-item ${dialer.id === activeId ? 'active' : ''} ${!dialer.unlocked ? 'locked' : ''}"
                 onclick="window.gameUI.handleDialerClick('${dialer.id}')">
                <div class="dialer-icon">${dialerIcons[dialer.id] || '📞'}</div>
                <div class="dialer-info">
                    <h4>${dialer.unlocked ? dialer.name : '🔒 ' + dialer.name}</h4>
                    <p>${dialer.unlocked ? `$${dialer.costPerAgentPerDay}/agent/day` : `Unlock: $${dialer.unlockCost.toLocaleString()}`}</p>
                </div>
                <div class="dialer-rate">
                    <div class="rate">${dialer.dialsPerMinutePerAgent}<span>/min</span></div>
                    <div class="status">${dialer.unlocked ? (dialer.id === activeId ? '✓ Active' : 'Available') : 'Locked'}</div>
                </div>
            </div>
        `).join('');
    }

    // ==================== SMART UPGRADE PRIORITY ====================

    /**
     * Calculate priority score for each upgrade based on current game state.
     * Higher score = should buy sooner.
     * ALWAYS returns a positive score for affordable upgrades so there's always a recommendation.
     */
    calculateUpgradePriority(upgrade, state) {
        const agents = state.agents.length;
        const leads = state.leadPool.getStats();
        const cash = state.cash;
        const maxed = upgrade.currentLevel >= upgrade.maxLevel;

        // Can't recommend maxed or unaffordable upgrades
        if (maxed) return -1000;
        if (cash < upgrade.cost) return -100; // Still track but low priority

        // Start with base score of 50 so we always have recommendations
        let score = 50;

        // Calculate key ratios - use available (fresh + redialable) for total dialing capacity
        const availableLeads = leads.available || leads.dialable;
        const freshLeads = leads.dialable;
        const leadsPerAgent = agents > 0 ? availableLeads / agents : 0;
        const freshPerAgent = agents > 0 ? freshLeads / agents : 0;
        const isLowOnLeads = freshLeads < agents * 30; // Focus on FRESH leads being low
        const isCriticallyLowOnLeads = freshLeads < agents * 15;
        const hasGoodLeadSupply = freshPerAgent > 75;

        // ========== LEAD PRIORITY (Most Important) ==========
        // If low on leads, ALWAYS recommend buying more - this is the #1 priority
        if (upgrade.id === 'lead_batch_50' || upgrade.id === 'lead_batch_200') {
            if (isCriticallyLowOnLeads) {
                // URGENT: Need leads NOW
                score += 500;
            } else if (isLowOnLeads) {
                // Important: Should buy leads soon
                score += 300;
            } else if (leadsPerAgent < 75) {
                // Could use more leads
                score += 100;
            }

            // Prefer bulk purchase if affordable
            if (upgrade.id === 'lead_batch_200' && cash >= 400) {
                score += 50; // Better value
            }
        }

        // ========== AGENT HIRING ==========
        if (upgrade.id === 'hire_agent') {
            if (hasGoodLeadSupply && agents < 10) {
                // Have leads, need agents to dial them
                score += 200;
            } else if (leadsPerAgent > 150 && agents < 5) {
                // Way too many leads per agent
                score += 300;
            } else if (isLowOnLeads) {
                // Don't hire if low on leads
                score -= 200;
            }
        }

        // ========== TRAINING (Good ROI with multiple agents) ==========
        if (upgrade.category === 'training') {
            // Training scales with agent count
            score += agents * 10;

            // Script training FIRST LEVEL is best early investment
            if (upgrade.id === 'script_training') {
                if (upgrade.currentLevel === 0) {
                    score += 100; // High priority for FIRST level
                } else {
                    score -= 30; // Deprioritize subsequent levels early game
                }
            }

            // Efficiency training is mid-game upgrade
            if (upgrade.id === 'efficiency_training') {
                if (agents >= 3 && upgrade.currentLevel === 0) {
                    score += 50;
                }
            }
        }

        // ========== REPUTATION (Important mid-game) ==========
        if (upgrade.category === 'reputation') {
            // Local presence is high value
            if (upgrade.id === 'local_presence' && upgrade.currentLevel === 0) {
                score += 100;
            }

            // Number pool helps prevent spam flagging
            if (upgrade.id === 'number_pool' && upgrade.currentLevel < 3) {
                score += 60;
            }

            // Low rep = urgent need
            if (state.reputation < 60) {
                score += 100;
            }
        }

        // ========== FACILITIES ==========
        if (upgrade.category === 'facilities') {
            // Break room scales with team size
            if (upgrade.id === 'break_room') {
                score += agents * 10;
            }
        }

        // ========== GENERAL MODIFIERS ==========

        // Cost efficiency bonus (cheaper = better for quick progress)
        score += Math.max(0, 50 - upgrade.cost / 20);

        // Tier penalty (higher tier = later in progression)
        score -= upgrade.tier * 20;

        // Diminishing returns for repeating same upgrade
        score -= upgrade.currentLevel * 25;

        // Ensure affordable upgrades always have positive score
        if (cash >= upgrade.cost && score < 10) {
            score = 10;
        }

        return Math.round(score);
    }

    getRecommendedUpgrade() {
        if (!this.game?.state) return null;

        const state = this.game.state;
        const upgrades = this.game.getAllUpgrades()
            .filter(u => u.currentLevel < u.maxLevel)
            .map(u => ({
                ...u,
                priority: this.calculateUpgradePriority(u, state)
            }))
            .filter(u => u.priority > 0 && state.cash >= u.cost) // Only affordable ones
            .sort((a, b) => b.priority - a.priority);

        return upgrades[0]?.id || null;
    }

    renderUpgrades() {
        const container = document.getElementById('upgrade-list');
        if (!container) return;

        const state = this.game.state;
        const leads = state.leadPool.getStats();
        const isBroke = leads.dialable < 10 && state.cash < 50;
        const recommendedId = this.getRecommendedUpgrade();

        let html = '';

        // Show broke warning if needed
        if (isBroke && this.freeLeadsCooldown <= 0) {
            html += `
                <div class="broke-warning">
                    <div class="broke-warning-title">🆘 Running Low!</div>
                    <div class="broke-warning-text">Low on leads and cash. Claim free emergency leads to continue.</div>
                    <button class="btn free-leads-btn" onclick="window.gameUI.claimFreeLeads()">
                        Claim 25 Free Leads
                    </button>
                </div>
            `;
        } else if (this.freeLeadsCooldown > 0) {
            html += `
                <div class="broke-warning" style="border-color: var(--text-muted);">
                    <div class="broke-warning-text">Free leads cooldown: ${Math.ceil(this.freeLeadsCooldown / 60)} min</div>
                </div>
            `;
        }

        // Get all upgrades and calculate priorities
        const upgrades = this.game.getAllUpgrades()
            .filter(u => this.upgradeCategory === 'all' || u.category === this.upgradeCategory)
            .map(u => ({
                ...u,
                priority: this.calculateUpgradePriority(u, state),
                isRecommended: u.id === recommendedId
            }))
            .sort((a, b) => {
                // Recommended always first
                if (a.isRecommended && !b.isRecommended) return -1;
                if (b.isRecommended && !a.isRecommended) return 1;
                // Then by priority score
                return b.priority - a.priority;
            });

        html += upgrades.map((upgrade, index) => {
            const canAfford = state.cash >= upgrade.cost;
            const maxed = upgrade.currentLevel >= upgrade.maxLevel;
            const isRecommended = upgrade.isRecommended && canAfford && !maxed;

            // Priority label
            let priorityLabel = '';
            if (isRecommended) {
                priorityLabel = '<span class="priority-badge recommended">⭐ RECOMMENDED</span>';
            } else if (upgrade.priority > 50 && canAfford && !maxed) {
                priorityLabel = '<span class="priority-badge high">High Priority</span>';
            } else if (upgrade.priority > 0 && canAfford && !maxed) {
                priorityLabel = '<span class="priority-badge medium">Good Option</span>';
            }

            return `
                <div class="upgrade-item ${canAfford && !maxed ? 'affordable' : ''} ${isRecommended ? 'recommended-upgrade' : ''}"
                     data-upgrade-id="${upgrade.id}">
                    <div class="upgrade-header">
                        <span class="upgrade-name">${upgrade.name}</span>
                        <span class="upgrade-tier">Lv ${upgrade.currentLevel}/${upgrade.maxLevel}</span>
                    </div>
                    ${priorityLabel}
                    <div class="upgrade-description">${upgrade.description}</div>
                    <div class="upgrade-footer">
                        <span class="upgrade-cost ${maxed ? 'maxed' : ''}">${maxed ? 'MAXED' : upgrade.cost.toLocaleString()}</span>
                        <button class="btn btn-primary btn-sm ${isRecommended ? 'btn-recommended' : ''}" 
                                ${!canAfford || maxed ? 'disabled' : ''}
                                onclick="event.stopPropagation(); window.gameUI.purchaseUpgrade('${upgrade.id}')">
                            ${maxed ? '✓' : isRecommended ? '⭐ Buy' : 'Buy'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    }

    renderActivityLog() {
        const container = document.getElementById('activity-log');
        if (!container) return;

        const icons = {
            dial: '📞',
            contact: '👤',
            conversion: '💰',
            complaint: '⚠️',
            info: 'ℹ️',
            hire: '👥'
        };

        container.innerHTML = this.activityLog.map((entry, index) => `
            <div class="log-entry ${entry.isNew ? 'new-entry' : ''}">
                <span class="log-time">${entry.time}</span>
                <span class="log-icon ${entry.type}">
                    ${icons[entry.type] || '•'}
                </span>
                <span class="log-message">${entry.message}</span>
                ${entry.extra ? `<span class="log-extra">${entry.extra}</span>` : ''}
            </div>
        `).join('');
    }

    renderLeadStats() {
        const stats = this.game.state.leadPool.getStats();
        const container = document.getElementById('lead-stats');
        if (!container) return;

        const lowLeads = stats.dialable < 20;
        const hasRedials = stats.redialable > 0;

        container.innerHTML = `
            <div class="lead-stat" ${lowLeads ? 'style="border: 1px solid var(--accent-warning);"' : ''}>
                <div class="lead-stat-value" ${lowLeads ? 'style="color: var(--accent-warning);"' : ''}>${stats.dialable}</div>
                <div class="lead-stat-label">Fresh</div>
            </div>
            <div class="lead-stat" ${hasRedials && stats.dialable === 0 ? 'style="border: 1px solid var(--accent-tertiary);"' : ''}>
                <div class="lead-stat-value" style="${hasRedials ? 'color: var(--accent-tertiary);' : ''}">${stats.redialable || 0}</div>
                <div class="lead-stat-label">Redial</div>
            </div>
            <div class="lead-stat">
                <div class="lead-stat-value" style="color: var(--accent-success);">${stats.converted}</div>
                <div class="lead-stat-label">Converted</div>
            </div>
        `;
    }

    // ==================== HELPERS ====================

    formatMoney(amount) {
        return Math.round(amount).toLocaleString();
    }

    formatState(state) {
        const labels = {
            idle: 'Ready',
            dialing: 'Dialing',
            on_call: 'On Call',
            wrap_up: 'Wrapping Up',
            break: 'On Break',
            training: 'Training'
        };
        return labels[state] || state;
    }

    // ==================== ACTIONS ====================

    selectAgent(agentId) {
        this.selectedAgentId = this.selectedAgentId === agentId ? null : agentId;
        this.renderAgents();
    }

    handleDialerClick(dialerId) {
        const dialer = this.game.state.dialerManager.dialers.get(dialerId);
        if (!dialer) return;

        if (!dialer.unlocked) {
            if (this.game.state.cash >= dialer.unlockCost) {
                if (this.game.unlockDialer(dialerId)) {
                    this.addLog('info', `Unlocked ${dialer.name}!`, '🔓');
                    this.showNotification('success', 'Dialer Unlocked!', dialer.name);
                    this.render();
                }
            } else {
                this.showNotification('warning', 'Not enough cash', `Need $${dialer.unlockCost.toLocaleString()}`);
            }
        } else {
            if (this.game.setDialer(dialerId)) {
                this.addLog('info', `Switched to ${dialer.name}`, '📱');
                this.renderDialers();
            }
        }
    }

    purchaseUpgrade(upgradeId) {
        if (!this.game || !this.gameStarted) {
            console.warn('Game not initialized yet');
            return;
        }

        const config = this.game.upgradeManager.getUpgradeConfig(upgradeId);

        if (this.game.purchaseUpgrade(upgradeId)) {
            const actionLabels = {
                hire_agent: '👥 Hired new agent!',
                lead_batch_50: '📋 Purchased 50 leads',
                lead_batch_200: '📋 Purchased 200 leads'
            };

            const logMessage = actionLabels[upgradeId] || `Purchased ${config.name}`;
            this.addLog('info', logMessage, '⬆️');
            this.showNotification('success', 'Upgrade Purchased', config.name);
            this.render();
        } else {
            this.showNotification('warning', 'Cannot Purchase', 'Check requirements or funds');
        }
    }

    setUpgradeCategory(category) {
        this.upgradeCategory = category;
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });
        this.renderUpgrades();
    }

    // ==================== RENDER LOOP ====================

    startRenderLoop() {
        setInterval(() => {
            if (this.game.isRunning) {
                this.render();
            }
        }, 500);

        setInterval(() => {
            this.updateTime();
        }, 1000);
    }

    updateMetrics() {
        this.renderMetrics();
        this.renderHeader();
    }

    updateTime() {
        this.renderTime();
    }
}

// Initialize
const gameUI = new GameUI();
window.gameUI = gameUI;

document.addEventListener('DOMContentLoaded', () => {
    gameUI.init().catch(console.error);
});

export { GameUI };
