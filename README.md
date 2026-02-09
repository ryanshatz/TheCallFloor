# The Call Floor

<p align="center">
  <img src="logo.png" alt="The Call Floor" width="600">
</p>

<p align="center">
  <strong>🎮 A 3D Call Center Management Tycoon Game</strong>
</p>

<p align="center">
  <a href="#-play-now">Play Now</a> •
  <a href="#-features">Features</a> •
  <a href="#-controls">Controls</a> •
  <a href="#-upgrades">Upgrades</a> •
  <a href="#-contributing">Contributing</a>
</p>

---

## 🎯 About

**The Call Floor** is a browser-based 3D tycoon game where you build and manage your own call center empire. Hire agents, purchase upgrades, manage leads, and grow your business from a small operation to a thriving call center!

Built with **Three.js** for immersive 3D graphics, the game runs entirely in your browser — no downloads required.

## 🎮 Play Now

1. Clone this repository
2. Open `index.html` in your browser, or
3. Run a local server: `python -m http.server 8080`
4. Navigate to `http://localhost:8080`

## ✨ Features

- **3D Environment**: Fully rendered call center with desks, agents, coffee machines, and office furniture
- **Agent Management**: Hire, train, and manage your growing sales team
- **Energy System**: Agents get tired and need breaks — hire a supervisor to auto-wake them
- **Warm vs Cold Calling**: Warm leads convert 3x better, but agents can cold call when leads run dry
- **28 Upgrades** across 6 categories with escalating costs and meaningful progression
- **Marketing System**: Auto-generate leads daily through Billboard, Social Media, Email Campaigns, Webinars, and Referrals
- **Extended Shifts**: Overtime Pay and Night Shift upgrades let agents work longer hours
- **Reputation System**: Earn rep through sales and QA — higher rep means better contact rates
- **Tutorial System**: Step-by-step onboarding walks you through game mechanics
- **Save/Load**: Progress auto-saves at the end of each day
- **Milestone Achievements**: Bronze, Silver, and Gold victory goals
- **Collapsible HUD**: Toggle the metrics bar for an unobstructed 3D view

## 🎛️ Controls

| Key | Action |
|-----|--------|
| **WASD** | Move around the office |
| **E** | Purchase upgrade (when on pad) |
| **F** | Wake sleeping agent |
| **H** | Open help screen |
| **SPACE** | Pause/Resume game |
| **1-4** | Set game speed |
| **ESC** | Close overlays / Skip tutorial |

## 🛒 Upgrades

The game features **28 upgrade pads** spread across 6 rows, each unlocking new capabilities. Walk over a glowing pad and press **E** to purchase.

---

### � Supervisor (FREE — Center Front)
Your first purchase! Hires a floor supervisor who patrols and automatically wakes tired agents.

---

### 📋 Row 1: Leads & Hiring (z=-10)
| Upgrade | Cost | Max | Effect |
|---------|------|-----|--------|
| 50 Leads | $100 | ∞ | +50 warm leads (17% contact rate) |
| 200 Leads | $350 | ∞ | +200 warm leads (bulk discount) |
| 500 Leads | $800 | ∞ | +500 premium leads |
| VIP Leads | $600 | ∞ | +100 pre-qualified VIP leads |
| Hire Agent | $200+ | ∞ | Recruit a new sales rep ($40/day wages) |

---

### ⚡ Row 2: Training & Tech (z=-14)
| Upgrade | Cost | Max | Effect |
|---------|------|-----|--------|
| Script Training | $150+ | 5 | +5% conversion rate per level |
| Local Presence | $300+ | 3 | +8% answer rate per level |
| Power Dialer | $500 | 1 | 2x dial speed |
| Predictive Dialer | $1,500 | 1 | AI-powered +40% efficiency |
| CRM System | $1,000+ | 3 | +3% conversion per level (follow-up tracking) |

---

### 🛋️ Row 3: Facilities (z=-18)
| Upgrade | Cost | Max | Effect |
|---------|------|-----|--------|
| Coffee Machine | ☕ $300 | 1 | -30% energy drain (spawns 3D coffee machine!) |
| Ergo Chairs | 🪑 $400+ | 2 | -10% energy drain per level |
| Break Room | 🛋️ $500+ | 2 | +25% energy regen during breaks |
| Snack Bar | 🍕 $400+ | 3 | Office perk for agents |
| Noise Cancelling | 🔇 $600+ | 2 | -15% energy drain per level |

---

### 🎧 Row 4: Management & Compliance (z=-22)
| Upgrade | Cost | Max | Effect |
|---------|------|-----|--------|
| QA Team | $800+ | 2 | +10 reputation per level, prevents rep decay |
| Bonus System | $750+ | 3 | +10% sale value per level |
| Team Lead | $1,500+ | 3 | +10% agent speed per level |
| Overtime Pay | $800+ | 2 | +30 min workday per level |
| Compliance Suite | $2,000 | 1 | Completely prevents reputation decay |

---

### 📱 Row 5: Marketing (z=-26)
Auto-generate leads at the end of each day — no manual purchasing needed!

| Upgrade | Cost | Max | Effect |
|---------|------|-----|--------|
| Billboard | $2,000 | 1 | +3 passive leads per day |
| Social Media | $1,500+ | 3 | Reputation-based daily leads (rep ÷ 20 per level) |
| Email Campaign | $800+ | 3 | +2 daily leads per agent per level |
| Webinar | $2,500+ | 2 | +200 leads NOW + 5 passive leads/day per level |
| Referral Program | $1,200+ | 3 | +5 auto leads per day per level |

---

### 🚀 Row 6: Expansion (z=-30)
Late-game power upgrades for maximum growth.

| Upgrade | Cost | Max | Effect |
|---------|------|-----|--------|
| Auto-Dialer | $2,500 | 1 | 3x dial speed (fully automated dialing) |
| Night Shift | $5,000 | 1 | Extends workday to 10pm (+4 hours!) |
| Analytics | $600+ | 2 | Data-driven reputation insights |

---

## 💼 Game Mechanics

### Warm vs Cold Calling
- **Warm leads**: 17% contact rate, 7% conversion, $70–150 sales
- **Cold calling**: 5% contact rate, 3% conversion, $40–90 sales, 30% more tiring
- Agents automatically cold call when warm leads run out

### Agent Energy
- Agents drain energy while working (affected by upgrades)
- At 30% energy: agent becomes **tired** (60% productivity)
- At 0% energy: agent **falls asleep** (no productivity)
- Supervisor auto-wakes agents, or press **F** near a sleeping agent

### Reputation (50–100)
- Gains: QA Team purchase, random sales events
- Losses: -1 per day without QA Team or Compliance Suite
- Higher rep = better contact rates on all calls

### Daily Auto-Lead Generation
Marketing upgrades generate free leads at the end of every day:
- Referral Program: +5/level
- Billboard: +3
- Social Media: rep ÷ 20 per level
- Email Campaign: agents × 2 per level
- Webinar: +5/level (ongoing after purchase)

## 🏆 Victory Goals

| Achievement | Requirement |
|-------------|-------------|
| 🥉 Bronze | Day 10 with $2,000+ |
| 🥈 Silver | Day 20 with $5,000+ |
| 🥇 Gold | Day 30 with $10,000+ |

## 🔧 Tech Stack

- **Three.js** — 3D rendering engine
- **Vanilla JavaScript** — Game logic & simulation
- **HTML5/CSS3** — UI/UX, HUD, overlays
- **LocalStorage** — Auto-save system

## 📁 Project Structure

```
TheCallFloor/
├── index.html      # Main HTML with UI and styles
├── game.js         # All game logic, 3D scene, mechanics
├── three.min.js    # Three.js library
├── logo.png        # Project logo
├── LICENSE         # MIT License
├── CONTRIBUTING.md # Contribution guidelines
└── README.md       # This file
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

Created by **Ryan Shatz** ([@ryanshatz](https://github.com/ryanshatz))

---

<p align="center">
  Made with ❤️ and ☕
</p>
