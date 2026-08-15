const COLORS = ["red", "blue", "green", "yellow", "pink"];
    const SIZE = 8;
    let nextTileId = 1;

    function game_getOrCreatePlayerId() {
      let id = localStorage.getItem("cube-pop-player-id");
      if (!id) {
        id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem("cube-pop-player-id", id);
      }
      return id;
    }

    const game = {
      board: [],
      level: 1,
      moves: 30,
      goals: {},
      selectedTool: null,
      maxUnlocked: Number(localStorage.getItem("cube-pop-unlocked") || 1),
      winStreak: Number(localStorage.getItem("cube-pop-win-streak") || 0),
      bestStars: JSON.parse(localStorage.getItem("cube-pop-stars") || "{}"),
      totalStars: Number(localStorage.getItem("cube-pop-total-stars") || 0),
      playerId: game_getOrCreatePlayerId(),
      playerName: localStorage.getItem("cube-pop-player-name") || "",
      account: JSON.parse(localStorage.getItem("cube-pop-active-account") || "null"),
      startMoves: 30,
      audio: null,
      busy: false,
      soundEnabled: localStorage.getItem("cube-pop-sound-enabled") !== "false",
      dailyChallengeLevel: null,
      difficulty: localStorage.getItem("cube-pop-difficulty") || "normal",
      currentCombo: 0,
      stats: JSON.parse(localStorage.getItem("cube-pop-stats") || JSON.stringify({
        gamesPlayed: 0,
        gamesWon: 0,
        totalMoves: 0,
        bestCombo: 0
      })),
      achievements: JSON.parse(localStorage.getItem("cube-pop-achievements") || JSON.stringify({
        "first-win": false,
        "five-wins": false,
        "ten-wins": false,
        "hundred-stars": false,
        "five-stars": false,
        "all-levels": false,
        "combo-3x": false,
        "easy-clear": false,
        "hard-clear": false,
        "daily-master": false
      })),

      init() {
        this.level = Number(localStorage.getItem("cube-pop-last-level") || this.level);
        this.bind();
        this.bindLeaderboard();
        this.bindStats();
        this.initPlayerName();
        this.initAccountSystem();
        this.updateSoundToggle();
        this.updateHomeStats();
        this.showHome();
      },

      initPlayerName() {
        const input = document.getElementById("playerName");
        if (!this.playerName) {
          this.playerName = `Player-${this.playerId.slice(-4).toUpperCase()}`;
          localStorage.setItem("cube-pop-player-name", this.playerName);
        }
        input.value = this.playerName;
        input.addEventListener("change", () => {
          const clean = input.value.trim().slice(0, 16) || `Player-${this.playerId.slice(-4).toUpperCase()}`;
          this.playerName = clean;
          input.value = clean;
          this.saveProgress();
          this.submitScore();
        });
      },

      async initAccountSystem() {
        const client = this.getSupabaseClient();
        const usernameInput = document.getElementById("accountUsername");
        const passwordInput = document.getElementById("accountPassword");
        
        if (client) {
          try {
            const { data } = await client.auth.getSession();
            if (data.session) {
              this.account = {
                id: data.session.user.id,
                username: data.session.user.user_metadata?.username || data.session.user.email?.split('@')[0] || 'Player'
              };
              this.playerId = this.account.id;
              this.playerName = this.account.username;
              if (usernameInput) usernameInput.value = this.account.username;
              await this.loadProfile();
            }
          } catch (error) {
            console.warn('Session check failed:', error);
          }
        }
        
        if (usernameInput) usernameInput.value = this.playerName || "";
        if (passwordInput) passwordInput.value = "";
        this.updateAccountStatus();
      },

      async loadProfile() {
        const client = this.getSupabaseClient();
        if (!client || !this.account) return;
        
        try {
          const { data, error } = await client
            .from('profiles')
            .select('total_stars,max_level,win_streak,games_played,games_won,best_combo')
            .eq('id', this.account.id)
            .single();
          
          if (error && error.code !== 'PGRST116') throw error;
          if (data) {
            this.totalStars = data.total_stars || 0;
            this.maxUnlocked = data.max_level || 1;
            this.winStreak = data.win_streak || 0;
            this.stats.gamesPlayed = data.games_played || 0;
            this.stats.gamesWon = data.games_won || 0;
            this.stats.bestCombo = data.best_combo || 0;
          }
        } catch (error) {
          console.warn('Failed to load profile:', error);
        }
      },

      async syncProfile() {
        const client = this.getSupabaseClient();
        if (!client || !this.account) return;
        
        try {
          const { error } = await client
            .from('profiles')
            .upsert({
              id: this.account.id,
              username: this.account.username,
              total_stars: this.totalStars,
              max_level: this.maxUnlocked,
              win_streak: this.winStreak,
              games_played: this.stats.gamesPlayed,
              games_won: this.stats.gamesWon,
              best_combo: this.stats.bestCombo,
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
          
          if (error) throw error;
        } catch (error) {
          console.warn('Failed to sync profile:', error);
        }
      },

      hashPassword(value) {
        let hash = 0;
        for (let i = 0; i < value.length; i += 1) {
          hash = ((hash << 5) - hash + value.charCodeAt(i)) >>> 0;
        }
        return String(hash);
      },

      setActiveAccount(account) {
        this.account = account;
        if (account) {
          this.playerId = account.id;
          this.playerName = account.username;
          localStorage.setItem("cube-pop-active-account", JSON.stringify(account));
          document.getElementById("playerName").value = account.username;
        } else {
          localStorage.removeItem("cube-pop-active-account");
          this.playerId = game_getOrCreatePlayerId();
          this.playerName = `Player-${this.playerId.slice(-4).toUpperCase()}`;
          document.getElementById("playerName").value = this.playerName;
        }
        localStorage.setItem("cube-pop-player-name", this.playerName);
        this.updateAccountStatus();
        this.saveProgress();
        this.submitScore();
      },

      updateAccountStatus() {
        const status = document.getElementById("accountStatus");
        if (!status) return;
        status.textContent = this.account ? `Signed in as ${this.account.username}` : "Guest mode";
      },

      async createAccount() {
        const username = document.getElementById("accountUsername").value.trim();
        const password = document.getElementById("accountPassword").value.trim();
        const client = this.getSupabaseClient();
        
        if (!client) {
          this.toast("Account system not available. Check Supabase setup.");
          return;
        }
        
        if (!username || username.length < 3) {
          this.toast("Username must be at least 3 characters");
          return;
        }
        if (!password || password.length < 4) {
          this.toast("Password must be at least 4 characters");
          return;
        }

        try {
          const email = `${username}+${Date.now()}@cubepop.local`;
          const { data, error } = await client.auth.signUp({
            email,
            password,
            options: {
              data: { username }
            }
          });
          
          if (error) throw error;
          if (!data.user) throw new Error('Signup failed');
          
          // Create profile
          const { error: profileError } = await client
            .from('profiles')
            .insert({
              id: data.user.id,
              username,
              total_stars: 0,
              max_level: 1,
              win_streak: 0
            });
          
          if (profileError) throw profileError;
          
          this.account = { id: data.user.id, username };
          this.setActiveAccount(this.account);
          this.toast(`Account created: ${username}`);
        } catch (error) {
          console.error('Signup failed:', error);
          this.toast(`Error: ${error.message || 'Signup failed'}`);
        }
      },

      async loginAccount() {
        const username = document.getElementById("accountUsername").value.trim();
        const password = document.getElementById("accountPassword").value.trim();
        const client = this.getSupabaseClient();
        
        if (!client) {
          this.toast("Account system not available. Check Supabase setup.");
          return;
        }
        
        if (!username || !password) {
          this.toast("Enter a username and password");
          return;
        }

        try {
          // First, try to find the user's email by username
          const { data: profiles, error: searchError } = await client
            .from('profiles')
            .select('id')
            .eq('username', username)
            .limit(1);
          
          if (searchError) throw searchError;
          if (!profiles || profiles.length === 0) {
            this.toast("Username not found");
            return;
          }
          
          const userId = profiles[0].id;
          const email = `${username}+${userId}@cubepop.local`;
          
          const { data, error } = await client.auth.signInWithPassword({
            email,
            password
          });
          
          if (error) throw error;
          if (!data.user) throw new Error('Login failed');
          
          this.account = { id: data.user.id, username };
          this.setActiveAccount(this.account);
          this.toast(`Welcome back, ${username}`);
        } catch (error) {
          console.error('Login failed:', error);
          this.toast(`Error: ${error.message || 'Login failed'}`);
        }
      },

      async logoutAccount() {
        const client = this.getSupabaseClient();
        
        if (client) {
          try {
            await client.auth.signOut();
          } catch (error) {
            console.warn('Logout failed:', error);
          }
        }
        
        this.setActiveAccount(null);
        this.toast("Logged out");
      },

      updateHomeStats() {
        document.getElementById("totalStars").textContent = `${this.totalStars} *`;
        const currentLevel = document.getElementById("currentLevelDisplay");
        if (currentLevel) {
          currentLevel.textContent = `Level ${this.maxUnlocked}`;
        }
        document.getElementById("unlockedLevel").textContent = this.winStreak;
      },

      saveProgress() {
        localStorage.setItem("cube-pop-unlocked", String(this.maxUnlocked));
        localStorage.setItem("cube-pop-win-streak", String(this.winStreak));
        localStorage.setItem("cube-pop-stars", JSON.stringify(this.bestStars));
        localStorage.setItem("cube-pop-total-stars", String(this.totalStars));
        localStorage.setItem("cube-pop-player-name", this.playerName);
        localStorage.setItem("cube-pop-last-level", String(this.level));
        localStorage.setItem("cube-pop-stats", JSON.stringify(this.stats));
        localStorage.setItem("cube-pop-achievements", JSON.stringify(this.achievements));
        if (this.account) {
          this.syncProfile();
        }
      },

      bindLeaderboard() {
        document.getElementById("openLeaderboard").addEventListener("click", () => this.openLeaderboard());
        document.getElementById("leaderboardClose").addEventListener("click", () => {
          document.getElementById("leaderboardModal").classList.add("hidden");
        });
        document.getElementById("leaderboardRefresh").addEventListener("click", () => this.loadLeaderboard());
      },

      openLeaderboard() {
        document.getElementById("leaderboardModal").classList.remove("hidden");
        this.loadLeaderboard();
      },

      bindStats() {
        document.getElementById("statsButton").addEventListener("click", () => this.openStats());
        document.getElementById("statsClose").addEventListener("click", () => {
          document.getElementById("statsModal").classList.add("hidden");
        });
        document.getElementById("achievementsButton").addEventListener("click", () => this.openAchievements());
        document.getElementById("achievementsClose").addEventListener("click", () => {
          document.getElementById("achievementsModal").classList.add("hidden");
        });
      },

      setRandomDifficulty() {
        const difficulties = ["easy", "normal", "hard"];
        this.difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
      },

      openStats() {
        const winRate = this.stats.gamesPlayed > 0
          ? Math.round((this.stats.gamesWon / this.stats.gamesPlayed) * 100)
          : 0;
        document.getElementById("gamesPlayed").textContent = this.stats.gamesPlayed;
        document.getElementById("statsBestLevel").textContent = this.winStreak;
        document.getElementById("statsTotalStars").textContent = this.totalStars;
        document.getElementById("statsBestCombo").textContent = this.stats.bestCombo;
        document.getElementById("statsTotalMoves").textContent = this.stats.totalMoves;
        document.getElementById("statsWinRate").textContent = `${winRate}%`;
        document.getElementById("statsModal").classList.remove("hidden");
      },

      openAchievements() {
        const achievementDefs = {
          "first-win": { name: "First Victory", description: "Win your first level", icon: "🏆" },
          "five-wins": { name: "Rising Star", description: "Win 5 levels", icon: "⭐" },
          "ten-wins": { name: "Champion", description: "Win 10 levels", icon: "👑" },
          "hundred-stars": { name: "Star Collector", description: "Collect 100 stars", icon: "✨" },
          "five-stars": { name: "Perfect Play", description: "Get 3 stars on a level", icon: "🌟" },
          "all-levels": { name: "Completionist", description: "Beat all levels", icon: "🎖️" },
          "combo-3x": { name: "Combo Master", description: "Achieve 3x combo multiplier", icon: "💥" },
          "easy-clear": { name: "Breeze", description: "Beat 5 levels on Easy", icon: "🌬️" },
          "hard-clear": { name: "Hardcore", description: "Beat 5 levels on Hard", icon: "🔥" },
          "daily-master": { name: "Daily Grind", description: "Complete 5 daily challenges", icon: "📅" }
        };

        const list = document.getElementById("achievementsList");
        list.innerHTML = "";
        Object.entries(achievementDefs).forEach(([key, def]) => {
          const unlocked = this.achievements[key];
          const item = document.createElement("div");
          item.className = `achievement-item ${unlocked ? "unlocked" : ""}`;
          item.innerHTML = `
            <div class="achievement-icon">${def.icon}</div>
            <div class="achievement-name">${def.name}</div>
            <div class="achievement-description">${def.description}</div>
          `;
          list.appendChild(item);
        });
        document.getElementById("achievementsModal").classList.remove("hidden");
      },

      getSupabaseClient() {
        const url = window.CUBE_POP_SUPABASE_URL || "";
        const anonKey = window.CUBE_POP_SUPABASE_ANON_KEY || "";

        if (!window.supabase || !url || !anonKey || url.includes("your-project") || anonKey.includes("your-public")) {
          return null;
        }

        if (!window.supabaseClient) {
          window.supabaseClient = window.supabase.createClient(url, anonKey, {
            auth: { persistSession: false }
          });
        }

        return window.supabaseClient;
      },

      getLocalLeaderboardEntries() {
        const entries = [];
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (!key || !key.startsWith("leaderboard:")) continue;
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const entry = JSON.parse(raw);
            if (entry && (entry.name || entry.totalStars || entry.maxLevel !== undefined)) {
              entries.push(entry);
            }
          } catch (error) {
            // Ignore unreadable local records.
          }
        }
        return entries;
      },

      async submitScore() {
        try {
          const client = this.getSupabaseClient();
          const payload = {
            name: this.playerName,
            total_stars: this.totalStars,
            max_level: this.maxUnlocked,
            updated_at: new Date().toISOString()
          };

          if (client && this.account) {
            payload.user_id = this.playerId;
            const { error } = await client
              .from("leaderboard")
              .upsert(payload, { onConflict: "user_id" });
            if (error) throw error;
            return;
          }

          const localEntry = {
            playerId: this.playerId,
            name: this.playerName,
            totalStars: this.totalStars,
            maxLevel: this.maxUnlocked,
            updatedAt: Date.now()
          };
          localStorage.setItem(`leaderboard:${this.playerId}`, JSON.stringify(localEntry));
        } catch (error) {
          console.warn("Leaderboard submit failed:", error);
        }
      },

      async loadLeaderboard() {
        const list = document.getElementById("leaderboardList");
        list.innerHTML = `<div class="leaderboard-empty">Loading...</div>`;

        try {
          const client = this.getSupabaseClient();
          if (client) {
            const { data, error } = await client
              .from("leaderboard")
              .select("user_id,name,total_stars,max_level")
              .order("total_stars", { ascending: false })
              .order("max_level", { ascending: false })
              .limit(20);

            if (error) throw error;
            this.renderLeaderboard((data || []).map((entry) => ({
              playerId: entry.user_id,
              name: entry.name,
              totalStars: entry.total_stars,
              maxLevel: entry.max_level
            })));
            return;
          }

          const entries = this.getLocalLeaderboardEntries()
            .map((entry) => ({
              playerId: entry.playerId,
              name: entry.name,
              totalStars: entry.totalStars,
              maxLevel: entry.maxLevel
            }))
            .sort((a, b) => (b.totalStars || 0) - (a.totalStars || 0));

          this.renderLeaderboard(entries.slice(0, 20));
        } catch (error) {
          console.error("Leaderboard load failed:", error);
          const localEntries = this.getLocalLeaderboardEntries().sort((a, b) => (b.totalStars || 0) - (a.totalStars || 0));
          if (localEntries.length) {
            this.renderLeaderboard(localEntries.slice(0, 20));
            return;
          }
          list.innerHTML = `<div class="leaderboard-empty">Couldn't load the leaderboard. Configure Supabase or keep playing to create local entries.</div>`;
        }
      },

      renderLeaderboard(entries) {
        const list = document.getElementById("leaderboardList");
        if (!entries.length) {
          list.innerHTML = `<div class="leaderboard-empty">No scores yet — be the first!</div>`;
          return;
        }
        list.innerHTML = "";
        entries.forEach((entry, index) => {
          const row = document.createElement("div");
          const entryId = entry.player_id || entry.playerId;
          const isMe = entryId === this.playerId;
          row.className = `leaderboard-row ${isMe ? "me" : ""}`;
          row.innerHTML = `
            <div class="leaderboard-rank">${index + 1}</div>
            <div class="leaderboard-name">${this.escapeHtml(entry.name || "Player")}<small>Level ${entry.max_level || entry.maxLevel || 1}</small></div>
            <div class="leaderboard-score">${entry.total_stars || entry.totalStars || 0} *</div>
          `;
          list.appendChild(row);
        });
      },

      escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
      },

      bind() {
        document.getElementById("newGame").addEventListener("click", () => this.startLevel(this.level));
        document.getElementById("hint").addEventListener("click", () => this.showHint());
        document.getElementById("homeButton").addEventListener("click", () => this.showHome());
        document.getElementById("continueLevel").addEventListener("click", () => this.startLevel(this.maxUnlocked));
        document.getElementById("resultMap").addEventListener("click", () => this.showHome());
        document.getElementById("resultRetry").addEventListener("click", () => this.startLevel(this.level));
        document.getElementById("resultNext").addEventListener("click", () => this.startLevel(this.level + 1));
        document.getElementById("dailyChallenge").addEventListener("click", () => this.startDailyChallenge());
        document.getElementById("soundToggle").addEventListener("click", () => this.toggleSound());
        document.getElementById("createAccountBtn").addEventListener("click", async () => { await this.createAccount(); });
        document.getElementById("loginAccountBtn").addEventListener("click", async () => { await this.loginAccount(); });
        document.getElementById("logoutAccountBtn").addEventListener("click", async () => { await this.logoutAccount(); });
        document.querySelectorAll(".booster").forEach((button) => {
          button.addEventListener("click", () => this.chooseTool(button.dataset.tool));
        });
      },

      updateSoundToggle() {
        const button = document.getElementById("soundToggle");
        if (!button) return;
        button.textContent = `Sound: ${this.soundEnabled ? "On" : "Off"}`;
        button.classList.toggle("active", this.soundEnabled);
      },

      toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        localStorage.setItem("cube-pop-sound-enabled", String(this.soundEnabled));
        this.updateSoundToggle();
        this.toast(this.soundEnabled ? "Sound on" : "Sound off");
      },

      startDailyChallenge() {
        const dateKey = new Date().toISOString().slice(0, 10);
        let seed = 0;
        for (let i = 0; i < dateKey.length; i += 1) {
          seed += dateKey.charCodeAt(i) * (i + 1);
        }
        const challengeLevel = 2 + (seed % 7);
        this.dailyChallengeLevel = challengeLevel;
        this.level = challengeLevel;
        this.maxUnlocked = Math.max(this.maxUnlocked, challengeLevel);
        this.saveProgress();
        this.startLevel(challengeLevel);
        this.toast(`Daily challenge: Level ${challengeLevel}`);
      },

      showHome() {
        this.hideResult();
        document.getElementById("home").classList.remove("hidden");
        document.getElementById("gameScreen").classList.add("hidden");
        this.level = Math.min(this.level, this.maxUnlocked);
        this.updateHomeStats();
      },

      startLevel(level) {
        this.hideResult();
        document.getElementById("home").classList.add("hidden");
        document.getElementById("gameScreen").classList.remove("hidden");
        this.level = level;
        this.currentCombo = 0;
        this.setRandomDifficulty();
        this.saveProgress();
        let baseMoves = Math.max(22, 32 - Math.floor(level * 1.5));
        if (this.difficulty === "easy") baseMoves = Math.floor(baseMoves * 1.4);
        if (this.difficulty === "hard") baseMoves = Math.floor(baseMoves * 0.7);
        this.moves = baseMoves;
        this.startMoves = this.moves;
        this.selectedTool = null;
        this.goals = this.makeGoals(level);
        this.board = Array.from({ length: SIZE }, () =>
          Array.from({ length: SIZE }, () => this.makeTile())
        );
        this.placeObstacles(level);
        this.ensurePlayable();
        this.render();
        const difficultyEmoji = { easy: "🟩", normal: "🟨", hard: "🟥" };
        this.toast(`Level ${level} - ${this.difficulty.toUpperCase()} ${difficultyEmoji[this.difficulty]}`);
        this.playSound("start");
      },

      makeGoals(level) {
        const shuffled = [...COLORS].sort(() => Math.random() - 0.5);
        const first = shuffled[0];
        const second = shuffled[1];
        const goals = {
          [first]: 10 + level * 2,
          [second]: 8 + level * 2
        };
        if (level >= 2) goals.crate = Math.min(8, 2 + Math.floor(level / 2));
        if (level >= 3) goals.ice = Math.min(10, 2 + level);
        return goals;
      },

      makeTile(color = COLORS[Math.floor(Math.random() * COLORS.length)], power = null, extra = {}) {
        return { id: nextTileId += 1, color, power, obstacle: null, ice: false, ...extra };
      },

      placeObstacles(level) {
        const crateCount = this.goals.crate || 0;
        const iceCount = this.goals.ice || 0;
        this.randomCells(crateCount).forEach(([row, col]) => {
          this.board[row][col] = this.makeTile("crate", null, { obstacle: "crate" });
        });

        this.randomCells(iceCount, (tile) => !tile.obstacle && !tile.ice).forEach(([row, col]) => {
          this.board[row][col].ice = true;
        });
      },

      chooseTool(tool) {
        this.selectedTool = this.selectedTool === tool ? null : tool;
        document.querySelectorAll(".booster").forEach((button) => {
          button.classList.toggle("active", button.dataset.tool === this.selectedTool);
        });
      },

      render() {
        document.getElementById("moves").textContent = this.moves;
        document.getElementById("level").textContent = this.level;
        document.getElementById("levelName").textContent = `Level ${this.level}`;
        document.getElementById("movesMeter").style.width = `${Math.max(0, (this.moves / Math.max(22, 32 - Math.floor(this.level * 1.5))) * 100)}%`;
        this.renderGoals();
        this.renderBoard();
      },

      renderGoals() {
        const goals = document.getElementById("goals");
        goals.innerHTML = "";
        Object.entries(this.goals).forEach(([color, left]) => {
          const row = document.createElement("div");
          row.className = "goal";
          const name = this.goalName(color);
          row.innerHTML = `
            <div class="goal-chip ${color}"></div>
            <div class="goal-name">${name}</div>
            <div class="goal-left">${Math.max(0, left)}</div>
          `;
          goals.appendChild(row);
        });
      },

      goalName(goal) {
        if (goal === "crate") return "Crates";
        if (goal === "ice") return "Ice";
        return `${goal[0].toUpperCase() + goal.slice(1)} cubes`;
      },

      renderBoard() {
        const board = document.getElementById("board");
        board.innerHTML = "";
        for (let row = 0; row < SIZE; row += 1) {
          for (let col = 0; col < SIZE; col += 1) {
            const tile = this.board[row][col];
            const button = document.createElement("button");
            button.className = `tile ${tile.color} ${tile.power || ""} ${tile.obstacle || ""} ${tile.ice ? "ice" : ""}`;
            button.type = "button";
            button.ariaLabel = tile.obstacle ? `${tile.obstacle} obstacle` : `${tile.color} cube`;
            button.dataset.id = tile.id;
            button.dataset.row = row;
            button.dataset.col = col;
            button.addEventListener("click", () => this.handleTile(row, col));
            board.appendChild(button);
          }
        }
      },

      async handleTile(row, col) {
        if (this.busy || this.moves <= 0) return;
        if (this.selectedTool) {
          await this.useTool(row, col);
          return;
        }

        const tile = this.board[row][col];
        if (tile.obstacle) {
          this.flashMessage("Break crates with nearby clears");
          this.playSound("bad");
          return;
        }
        const group = this.findGroup(row, col, tile.color);
        if (tile.power) {
          const partner = this.findAdjacentPower(row, col);
          if (partner) {
            await this.activateCombo(row, col, partner[0], partner[1]);
          } else {
            await this.activatePower(row, col, tile.power, tile.color);
          }
          this.afterMove();
          return;
        }

        if (group.length < 2) {
          this.flashMessage("Find a bigger group");
          this.playSound("bad");
          return;
        }

        await this.clearGroup(group, tile.color);
        this.afterMove();
      },

      findGroup(row, col, color) {
        const seen = new Set();
        const stack = [[row, col]];
        const group = [];

        while (stack.length) {
          const [r, c] = stack.pop();
          const key = `${r},${c}`;
          if (seen.has(key) || !this.inside(r, c)) continue;
          seen.add(key);
          const tile = this.board[r][c];
          if (!tile || tile.color !== color || tile.power || tile.obstacle) continue;
          group.push([r, c]);
          stack.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
        }

        return group;
      },

      async clearGroup(group, color) {
        this.busy = true;
        this.moves -= 1;
        const adjacentCrates = this.getAdjacentCrates(group);

        let power = null;
        if (group.length >= 9) power = "rainbow";
        else if (group.length >= 7) power = "bomb";
        else if (group.length >= 5) power = "rocket";

        const removed = [];
        const removedGroup = [];
        const cracked = [];
        group.forEach(([r, c]) => {
          const tile = this.board[r][c];
          if (tile.ice) {
            tile.ice = false;
            this.countGoal("ice");
            cracked.push([r, c]);
          } else {
            this.countGoal(tile.color);
            removed.push([r, c]);
            removedGroup.push([r, c]);
          }
        });
        adjacentCrates.forEach(([r, c]) => {
          this.countGoal("crate");
          removed.push([r, c]);
        });

        removed.forEach(([r, c]) => this.markPop(r, c));
        cracked.forEach(([r, c]) => this.markCrack(r, c));
        this.playSound(power ? "power" : "clear");
        
        if (power) {
          this.currentCombo += removed.length;
        }

        await this.wait(170);
        removed.forEach(([r, c]) => { this.board[r][c] = null; });

        if (power && removedGroup.length) {
          const [r, c] = removedGroup[Math.floor(removedGroup.length / 2)];
          this.board[r][c] = this.makeTile(color, power);
        }

        await this.animateGravity(this.dropAndFill());
        this.ensurePlayable();
        this.busy = false;
      },

      async activatePower(row, col, power, color) {
        this.busy = true;
        this.moves -= 1;
        let cells = [];

        if (power === "rocket") {
          for (let i = 0; i < SIZE; i += 1) cells.push([row, i], [i, col]);
        }

        if (power === "bomb") {
          for (let r = row - 2; r <= row + 2; r += 1) {
            for (let c = col - 2; c <= col + 2; c += 1) {
              if (this.inside(r, c)) cells.push([r, c]);
            }
          }
        }

        if (power === "rainbow") {
          for (let r = 0; r < SIZE; r += 1) {
            for (let c = 0; c < SIZE; c += 1) {
              if (this.board[r][c].color === color) cells.push([r, c]);
            }
          }
        }

        const { removed, cracked } = this.applyHits(this.uniqueCells(cells));
        removed.forEach(([r, c]) => this.markPop(r, c));
        cracked.forEach(([r, c]) => this.markCrack(r, c));
        this.playSound(power);
        await this.wait(180);
        removed.forEach(([r, c]) => { this.board[r][c] = null; });
        await this.animateGravity(this.dropAndFill());
        this.ensurePlayable();
        this.busy = false;
      },

      findAdjacentPower(row, col) {
        const neighbors = [[row + 1, col], [row - 1, col], [row, col + 1], [row, col - 1]];
        for (const [r, c] of neighbors) {
          if (!this.inside(r, c)) continue;
          const tile = this.board[r][c];
          if (tile && tile.power) return [r, c];
        }
        return null;
      },

      async activateCombo(rowA, colA, rowB, colB) {
        this.busy = true;
        this.moves -= 1;

        const tileA = this.board[rowA][colA];
        const tileB = this.board[rowB][colB];
        const key = [tileA.power, tileB.power].sort().join("+");
        const cells = [[rowA, colA], [rowB, colB]];

        const addCross = (r, c) => {
          for (let i = 0; i < SIZE; i += 1) {
            cells.push([r - 1, i], [r, i], [r + 1, i]);
            cells.push([i, c - 1], [i, c], [i, c + 1]);
          }
        };
        const addBlast = (r, c, radius) => {
          for (let rr = r - radius; rr <= r + radius; rr += 1) {
            for (let cc = c - radius; cc <= c + radius; cc += 1) {
              cells.push([rr, cc]);
            }
          }
        };
        const addColor = (color, effect) => {
          for (let r = 0; r < SIZE; r += 1) {
            for (let c = 0; c < SIZE; c += 1) {
              const tile = this.board[r][c];
              if (tile && !tile.obstacle && tile.color === color) {
                cells.push([r, c]);
                if (effect) effect(r, c);
              }
            }
          }
        };
        const otherColor = () => (tileA.power === "rainbow" ? tileB.color : tileA.color);

        if (key === "rocket+rocket") {
          addCross(rowA, colA);
        } else if (key === "bomb+rocket") {
          addCross(rowA, colA);
          addBlast(rowA, colA, 2);
        } else if (key === "bomb+bomb") {
          addBlast(rowA, colA, 3);
        } else if (key === "rainbow+rainbow") {
          for (let r = 0; r < SIZE; r += 1) {
            for (let c = 0; c < SIZE; c += 1) cells.push([r, c]);
          }
        } else if (key === "rainbow+rocket") {
          addColor(otherColor(), (r, c) => {
            for (let i = 0; i < SIZE; i += 1) cells.push([r, i], [i, c]);
          });
        } else if (key === "bomb+rainbow") {
          addColor(otherColor(), (r, c) => addBlast(r, c, 1));
        }

        const { removed, cracked } = this.applyHits(this.uniqueCells(cells));
        removed.forEach(([r, c]) => this.markPop(r, c));
        cracked.forEach(([r, c]) => this.markCrack(r, c));
        this.markCombo(rowA, colA);
        this.markCombo(rowB, colB);
        this.currentCombo += removed.length;
        this.shakeBoard();
        this.showComboLabel(rowA, colA, rowB, colB, key);
        this.playSound("combo");
        this.flashMessage("Combo!");
        await this.wait(220);
        removed.forEach(([r, c]) => { this.board[r][c] = null; });
        await this.animateGravity(this.dropAndFill());
        this.ensurePlayable();
        this.busy = false;
      },

      async useTool(row, col) {
        const tool = this.selectedTool;
        this.chooseTool(tool);
        if (tool === "swap") {
          this.shuffleBoard();
          this.playSound("shuffle");
          this.moves = Math.max(0, this.moves - 1);
          this.afterMove();
          return;
        }

        if (tool === "hammer") {
          await this.clearCells([[row, col]], 40);
        }

        if (tool === "burst") {
          const cells = [];
          for (let r = row - 1; r <= row + 1; r += 1) {
            for (let c = col - 1; c <= col + 1; c += 1) {
              if (this.inside(r, c)) cells.push([r, c]);
            }
          }
          await this.clearCells(cells, 30);
        }

        this.moves = Math.max(0, this.moves - 1);
        this.afterMove();
      },

      async clearCells(cells, points) {
        this.busy = true;
        cells = this.uniqueCells(cells);
        const { removed, cracked } = this.applyHits(cells);
        removed.forEach(([r, c]) => this.markPop(r, c));
        cracked.forEach(([r, c]) => this.markCrack(r, c));
        this.playSound("clear");
        await this.wait(170);
        removed.forEach(([r, c]) => { this.board[r][c] = null; });
        await this.animateGravity(this.dropAndFill());
        this.ensurePlayable();
        this.busy = false;
      },

      afterMove(renderNow = true) {
        if (this.won()) {
          this.maxUnlocked = Math.max(this.maxUnlocked, this.level + 1);
          this.winStreak += 1;
          const earned = this.starCount();
          const multiplier = Math.min(5, 1 + Math.floor(this.currentCombo / 10));
          const earnedWithMultiplier = Math.floor(earned * multiplier);
          this.bestStars[this.level] = Math.max(this.bestStars[this.level] || 0, earned);
          this.totalStars += earnedWithMultiplier;
          this.stats.gamesPlayed += 1;
          this.stats.gamesWon += 1;
          this.stats.totalMoves += this.startMoves - this.moves;
          if (this.currentCombo > this.stats.bestCombo) {
            this.stats.bestCombo = this.currentCombo;
          }
          this.saveProgress();
          this.updateHomeStats();
          this.checkAchievements("win", earned);
          this.submitScore();
          this.render();
          this.playSound("win");
          this.showResult(true, earned, multiplier);
          return;
        }

        if (this.moves <= 0) {
          this.winStreak = 0;
          this.stats.gamesPlayed += 1;
          this.stats.totalMoves += this.startMoves;
          this.saveProgress();
          this.render();
          this.playSound("lose");
          this.showResult(false, 0);
          return;
        }

        if (renderNow) this.render();
      },

      countGoal(color) {
        if (this.goals[color] > 0) this.goals[color] -= 1;
      },

      applyHits(cells) {
        const removed = [];
        const cracked = [];
        cells.forEach(([r, c]) => {
          const tile = this.board[r][c];
          if (!tile) return;
          if (tile.obstacle === "crate") {
            this.countGoal("crate");
            removed.push([r, c]);
            return;
          }
          if (tile.ice) {
            tile.ice = false;
            this.countGoal("ice");
            cracked.push([r, c]);
            return;
          }
          this.countGoal(tile.color);
          removed.push([r, c]);
        });
        return { removed, cracked };
      },

      getAdjacentCrates(cells) {
        const crates = [];
        const seen = new Set();
        cells.forEach(([row, col]) => {
          [[row + 1, col], [row - 1, col], [row, col + 1], [row, col - 1]].forEach(([r, c]) => {
            const key = `${r},${c}`;
            if (seen.has(key) || !this.inside(r, c)) return;
            const tile = this.board[r][c];
            if (tile && tile.obstacle === "crate") {
              seen.add(key);
              crates.push([r, c]);
            }
          });
        });
        return crates;
      },

      randomCells(count, predicate = () => true) {
        const cells = [];
        for (let row = 0; row < SIZE; row += 1) {
          for (let col = 0; col < SIZE; col += 1) {
            if (predicate(this.board[row][col], row, col)) cells.push([row, col]);
          }
        }
        return cells.sort(() => Math.random() - 0.5).slice(0, count);
      },

      won() {
        return Object.values(this.goals).every((left) => left <= 0);
      },

      showResult(won, earned = 0, multiplier = 1) {
        const stars = won ? earned : 0;
        const finalStars = won ? Math.floor(stars * multiplier) : 0;
        const modal = document.getElementById("resultModal");
        document.getElementById("resultTitle").textContent = won ? "Level Complete" : "Try Again";
        document.getElementById("resultMoves").textContent = this.moves;
        document.getElementById("resultLevel").textContent = this.level;
        document.getElementById("resultStarsEarned").textContent = multiplier > 1 
          ? `+${finalStars} (${stars}×${multiplier})`
          : `+${finalStars}`;
        document.getElementById("resultTotalStars").textContent = this.totalStars;
        document.getElementById("resultNext").disabled = !won;

        const starRow = document.getElementById("resultStars");
        starRow.innerHTML = "";
        for (let i = 1; i <= 3; i += 1) {
          const star = document.createElement("div");
          star.className = `star ${i <= stars ? "on" : ""}`;
          star.textContent = "*";
          starRow.appendChild(star);
        }

        modal.classList.remove("hidden");
      },

      hideResult() {
        document.getElementById("resultModal").classList.add("hidden");
      },

      starCount() {
        const spare = this.moves / Math.max(1, this.startMoves);
        let stars = 1;
        if (spare >= 0.2) stars += 1;
        if (spare >= 0.45) stars += 1;
        return stars;
      },

      dropAndFill() {
        const animations = new Map();
        for (let col = 0; col < SIZE; col += 1) {
          const stack = [];
          for (let row = SIZE - 1; row >= 0; row -= 1) {
            if (this.board[row][col]) stack.push({ tile: this.board[row][col], fromRow: row });
          }
          for (let row = SIZE - 1; row >= 0; row -= 1) {
            const falling = stack.shift();
            if (falling) {
              this.board[row][col] = falling.tile;
              animations.set(falling.tile.id, row - falling.fromRow);
            } else {
              const tile = this.makeTile();
              this.board[row][col] = tile;
              animations.set(tile.id, row + 1);
            }
          }
        }
        return animations;
      },

      async animateGravity(animations) {
        this.render();
        const board = document.getElementById("board");
        const firstTile = board.querySelector(".tile");
        const gap = Number.parseFloat(getComputedStyle(board).gap) || 0;
        const step = firstTile ? firstTile.getBoundingClientRect().height + gap : 0;

        board.querySelectorAll(".tile").forEach((tile) => {
          const rows = animations.get(Number(tile.dataset.id)) || 0;
          if (rows > 0 && step > 0) {
            tile.classList.add("falling");
            tile.style.transform = `translateY(${-rows * step}px)`;
          }
        });

        await this.wait(30);
        board.querySelectorAll(".tile.falling").forEach((tile) => {
          tile.style.transform = "translateY(0)";
        });
        this.playSound("fall");
        await this.wait(300);
        board.querySelectorAll(".tile.falling").forEach((tile) => {
          tile.classList.remove("falling");
          tile.style.transform = "";
        });
      },

      showHint() {
        const hint = this.findBestGroup();
        if (!hint) {
          this.shuffleBoard();
          this.render();
          this.toast("Shuffled");
          return;
        }
        this.render();
        hint.group.forEach(([r, c]) => {
          const index = r * SIZE + c;
          document.getElementById("board").children[index].classList.add("hint");
        });
        setTimeout(() => this.render(), 900);
      },

      findBestGroup() {
        const seen = new Set();
        let best = null;
        for (let r = 0; r < SIZE; r += 1) {
          for (let c = 0; c < SIZE; c += 1) {
            const key = `${r},${c}`;
            if (seen.has(key)) continue;
            const tile = this.board[r][c];
            if (tile.obstacle) continue;
            const group = this.findGroup(r, c, tile.color);
            group.forEach(([gr, gc]) => seen.add(`${gr},${gc}`));
            if (group.length >= 2 && (!best || group.length > best.group.length)) {
              best = { group, color: tile.color };
            }
          }
        }
        return best;
      },

      ensurePlayable() {
        let attempts = 0;
        let neededShuffle = false;
        while (!this.findBestGroup() && attempts < 8) {
          this.shuffleBoard();
          attempts += 1;
          neededShuffle = true;
        }
        if (neededShuffle) {
          this.playSound("shuffle");
          this.toast("No moves left — board shuffled");
        }
      },

      shuffleBoard() {
        const flat = this.board.flat().sort(() => Math.random() - 0.5);
        this.board = Array.from({ length: SIZE }, (_, r) =>
          Array.from({ length: SIZE }, (_, c) => flat[r * SIZE + c] || this.makeTile())
        );
      },

      markCombo(row, col) {
        const index = row * SIZE + col;
        const tile = document.getElementById("board").children[index];
        if (tile) tile.classList.add("combo-glow");
      },

      shakeBoard() {
        const wrap = document.querySelector(".board-wrap");
        wrap.classList.remove("shake");
        void wrap.offsetWidth;
        wrap.classList.add("shake");
        setTimeout(() => wrap.classList.remove("shake"), 340);
      },

      showComboLabel(rowA, colA, rowB, colB, key) {
        const names = {
          "rocket+rocket": "Double Rocket!",
          "bomb+rocket": "Rocket Blast!",
          "bomb+bomb": "Mega Bomb!",
          "rainbow+rainbow": "Board Wipe!",
          "rainbow+rocket": "Color Storm!",
          "bomb+rainbow": "Color Bomb!"
        };
        const board = document.getElementById("board");
        const first = board.querySelector(".tile");
        if (!first) return;
        const wrapRect = document.querySelector(".board-wrap").getBoundingClientRect();
        const cellIndex = Math.round((rowA + rowB) / 2) * SIZE + Math.round((colA + colB) / 2);
        const anchor = board.children[cellIndex] || board.children[0];
        const rect = anchor.getBoundingClientRect();
        const label = document.createElement("div");
        label.className = "combo-label";
        label.textContent = names[key] || "Combo!";
        label.style.left = `${rect.left - wrapRect.left + rect.width / 2}px`;
        label.style.top = `${rect.top - wrapRect.top + rect.height / 2}px`;
        document.querySelector(".board-wrap").appendChild(label);
        setTimeout(() => label.remove(), 650);
      },

      markPop(row, col) {
        const index = row * SIZE + col;
        const tile = document.getElementById("board").children[index];
        if (tile) tile.classList.add("pop");
      },

      markCrack(row, col) {
        const index = row * SIZE + col;
        const tile = document.getElementById("board").children[index];
        if (tile) tile.classList.add("crack");
      },

      uniqueCells(cells) {
        const seen = new Set();
        return cells.filter(([r, c]) => {
          const key = `${r},${c}`;
          if (seen.has(key) || !this.inside(r, c)) return false;
          seen.add(key);
          return Boolean(this.board[r][c]);
        });
      },

      inside(row, col) {
        return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
      },

      flashMessage(text) {
        const message = document.getElementById("message");
        message.textContent = text;
        message.classList.add("show");
        clearTimeout(this.messageTimer);
        this.messageTimer = setTimeout(() => message.classList.remove("show"), 900);
      },

      toast(text) {
        const toast = document.getElementById("toast");
        toast.textContent = text;
        toast.classList.add("show");
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => toast.classList.remove("show"), 900);
      },

      playSound(type) {
        if (!this.soundEnabled) return;
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return;
          this.audio = this.audio || new AudioContext();
          if (this.audio.state === "suspended") this.audio.resume();

          const now = this.audio.currentTime;
          const patterns = {
            start: [[440, 0], [660, 0.08], [880, 0.16]],
            clear: [[520, 0], [690, 0.05]],
            fall: [[180, 0], [140, 0.055]],
            rocket: [[740, 0], [980, 0.06]],
            bomb: [[120, 0], [80, 0.08]],
            rainbow: [[780, 0], [980, 0.05], [1180, 0.1]],
            combo: [[600, 0], [900, 0.06], [1200, 0.12], [1500, 0.18]],
            power: [[620, 0], [860, 0.06]],
            shuffle: [[320, 0], [240, 0.05], [390, 0.1]],
            win: [[523, 0], [659, 0.1], [784, 0.2], [1046, 0.32]],
            lose: [[260, 0], [190, 0.12]],
            bad: [[120, 0]]
          };

          (patterns[type] || patterns.clear).forEach(([frequency, offset]) => {
            const osc = this.audio.createOscillator();
            const gain = this.audio.createGain();
            osc.type = type === "fall" || type === "bomb" ? "triangle" : "sine";
            osc.frequency.setValueAtTime(frequency, now + offset);
            gain.gain.setValueAtTime(0.001, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.055, now + offset + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);
            osc.connect(gain);
            gain.connect(this.audio.destination);
            osc.start(now + offset);
            osc.stop(now + offset + 0.16);
          });
        } catch (error) {
          // Audio is optional; gameplay should never depend on it.
        }
      },

      checkAchievements(type, earned = 0) {
        const newAchievements = [];

        if (type === "win") {
          if (!this.achievements["first-win"]) {
            this.achievements["first-win"] = true;
            newAchievements.push("first-win");
          }
          if (this.stats.gamesWon === 5 && !this.achievements["five-wins"]) {
            this.achievements["five-wins"] = true;
            newAchievements.push("five-wins");
          }
          if (this.stats.gamesWon === 10 && !this.achievements["ten-wins"]) {
            this.achievements["ten-wins"] = true;
            newAchievements.push("ten-wins");
          }
          if (earned === 3 && !this.achievements["five-stars"]) {
            this.achievements["five-stars"] = true;
            newAchievements.push("five-stars");
          }
          if (this.totalStars >= 100 && !this.achievements["hundred-stars"]) {
            this.achievements["hundred-stars"] = true;
            newAchievements.push("hundred-stars");
          }
          if (this.maxUnlocked === 20 && !this.achievements["all-levels"]) {
            this.achievements["all-levels"] = true;
            newAchievements.push("all-levels");
          }
          if (this.currentCombo >= 30 && !this.achievements["combo-3x"]) {
            this.achievements["combo-3x"] = true;
            newAchievements.push("combo-3x");
          }
        }

        newAchievements.forEach((achId) => this.showAchievementNotification(achId));
      },

      showAchievementNotification(achId) {
        const achievementDefs = {
          "first-win": { name: "First Victory", icon: "🏆" },
          "five-wins": { name: "Rising Star", icon: "⭐" },
          "ten-wins": { name: "Champion", icon: "👑" },
          "hundred-stars": { name: "Star Collector", icon: "✨" },
          "five-stars": { name: "Perfect Play", icon: "🌟" },
          "all-levels": { name: "Completionist", icon: "🎖️" },
          "combo-3x": { name: "Combo Master", icon: "💥" }
        };

        const ach = achievementDefs[achId];
        if (!ach) return;

        const toast = document.getElementById("achievementToast");
        toast.innerHTML = `
          <div class="achievement-toast-content">
            <div class="achievement-toast-icon">${ach.icon}</div>
            <div class="achievement-toast-text">
              <div class="achievement-toast-label">Achievement Unlocked</div>
              <div class="achievement-toast-title">${ach.name}</div>
            </div>
          </div>
        `;
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 4000);
      },

      wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }
    };

    game.init();
