(function () {
   const CyberMode = {
      isOpen: false,
      activeToolId: 'ip',

      tools: [
         { id: 'leak', name: 'Data Breach', desc: 'Scan for leaked credentials across known breaches.', placeholder: 'e.g. user@email.com' },
         { id: 'cinema', name: 'Media Stream', desc: 'Laboratory node for research & streaming.', placeholder: 'Paste Video URL (MP4/HLS)' },
         { id: 'chat', name: 'Lab Chat', desc: 'Anonymous room-based communication node.', placeholder: 'Room Name (e.g. general)' },
         { id: 'dns', name: 'DNS Lookup', desc: 'Retrieve A, MX, and TXT DNS records.', placeholder: 'e.g. google.com' },
         { id: 'ssl', name: 'SSL Checker', desc: 'Detailed SSL/TLS certificate analysis.', placeholder: 'e.g. apple.com' }
      ],

      init() {
         this.createUI();
         this.toggle();
         this.switchTool('leak');
      },

      createUI() {
         if (document.querySelector('.cyber-overlay')) return;

         const overlay = document.createElement('div');
         overlay.className = 'cyber-overlay';
         overlay.innerHTML = `
                <aside class="cyber-sidebar">
                    <div class="cyber-logo">LAB</div>
                    <nav class="cyber-nav">
                        ${this.tools.map(t => `
                            <button class="cyber-nav-item" data-tool="${t.id}">
                                <span class="tool-icon">_</span> ${t.name}
                            </button>
                        `).join('')}
                    </nav>
                </aside>
                <main class="cyber-content">
                    <header class="cyber-header">
                        <div class="cyber-status">TERMINAL_STATUS: <span style="color:#fff">READY</span></div>
                        <button class="cyber-close">CLOSE_ESC</button>
                    </header>
                    <div id="cyber-view-container"></div>
                </main>
            `;
         document.body.appendChild(overlay);

         // Bind events
         overlay.querySelectorAll('.cyber-nav-item').forEach(btn => {
            btn.addEventListener('click', () => this.switchTool(btn.dataset.tool));
         });

         overlay.querySelector('.cyber-close').addEventListener('click', () => this.toggle());

         this.overlay = overlay;
         this.viewContainer = document.getElementById('cyber-view-container');

         document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) this.toggle();
         });
      },

      toggle() {
         this.isOpen = !this.isOpen;
         this.overlay.classList.toggle('open', this.isOpen);
         document.body.style.overflow = this.isOpen ? 'hidden' : '';
      },

      switchTool(id) {
         this.activeToolId = id;
         const tool = this.tools.find(t => t.id === id);
         if (!tool) return;

         // Update nav active state
         this.overlay.querySelectorAll('.cyber-nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === id);
         });

         if (this.chatTimer) clearInterval(this.chatTimer);
         this.renderToolView(tool);
      },

      renderToolView(tool) {
         if (tool.id === 'chat') {
            this.renderChatUI();
            return;
         }

         this.viewContainer.innerHTML = `
                <div class="tool-view active">
                    <h1 class="tool-title">${tool.name}</h1>
                    <p class="tool-desc">${tool.desc}</p>
                    
                    <div class="input-group">
                        <input type="text" class="cyber-input" id="tool-input" placeholder="${tool.placeholder}" ${tool.id === 'proxies' ? 'disabled' : ''}>
                        <button class="cyber-btn" id="run-scan-btn">Run Scan</button>
                    </div>

                    <div class="result-container" id="tool-results">
                        <div style="opacity:0.3; text-align:center; padding-top:2rem">Awaiting target input...</div>
                    </div>
                </div>
            `;

         const btn = document.getElementById('run-scan-btn');
         const input = document.getElementById('tool-input');

         btn.addEventListener('click', () => this.runScan(tool.id, input.value.trim()));
         input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.runScan(tool.id, input.value.trim());
         });

         if (tool.id === 'proxies') {
            this.runScan('proxies', '');
         }
      },

      runScan(id, target) {
         if (!target && id !== 'proxies') return;

         const results = document.getElementById('tool-results');
         results.innerHTML = `
                <div class="cyber-loader">
                    <div class="scan-progress"><div class="scan-bar" id="scan-bar"></div></div>
                    <div class="loader-text">SCANNING_TARGET: ${target || 'NETWORK'}</div>
                </div>
            `;

         const bar = document.getElementById('scan-bar');
         let p = 0;
         const iv = setInterval(() => {
            p += Math.random() * 20;
            bar.style.width = Math.min(p, 100) + '%';
            if (p >= 100) {
               clearInterval(iv);
               this.fetchData(id, target);
            }
         }, 200);
      },

      async fetchData(id, target) {
         try {
            const res = await fetch(`/api/cyber-scan?tool=${id}&target=${target || ''}`);
            const json = await res.json();
            this.renderResults(id, json.data || json.mock);
         } catch (err) {
            console.error(err);
            this.renderResults(id, null);
         }
      },

      renderResults(id, data) {
         const results = document.getElementById('tool-results');
         if (!data) {
            results.innerHTML = `<div style="color:red">ERROR: Connection to Node.js server failed.</div>`;
            return;
         }

         let html = '<div class="result-grid">';

         switch (id) {
            case 'ip':
               html += this.createStatBox('ISP', data.isp);
               html += this.createStatBox('City', data.city);
               html += this.createStatBox('Country', data.country);
               html += this.createStatBox('Risk Score', data.threat_score + '/100');
               html += this.createStatBox('Is Proxy', data.proxy ? 'YES' : 'NO');
               break;
            case 'subdomains':
               if (Array.isArray(data)) {
                  data.slice(0, 10).forEach(s => { html += this.createStatBox('Subdomain', s); });
               } else { html += `<div>No subdomains found.</div>`; }
               break;
            case 'malicious':
               html += this.createStatBox('Status', data.status);
               html += this.createStatBox('Verdict', data.verdict);
               html += this.createStatBox('Detection Rate', data.engines || '0/68');
               break;
            case 'leak':
               html += this.createStatBox('Breached', data.leaked ? 'YES' : 'NO');
               html += this.createStatBox('Total Leaks', data.total || 0);
               html += this.createStatBox('Sources', Array.isArray(data.sources) ? data.sources.join(', ') : 'none');
               html += this.createStatBox('Instruction', data.advice || 'Safe.');
               break;
            case 'ssl':
               html += this.createStatBox('Valid', data.valid ? 'YES' : 'NO');
               html += this.createStatBox('Expires', data.expires);
               html += this.createStatBox('Issuer', data.issuer);
               html += this.createStatBox('Protocol', data.protocol);
               break;
            case 'dns':
               if (data.A) data.A.forEach(a => { html += this.createStatBox('A Record', a); });
               if (data.MX) data.MX.forEach(m => { html += this.createStatBox('MX Record', m); });
               if (data.TXT) data.TXT.forEach(t => { html += this.createStatBox('TXT Record', t.slice(0, 50) + '...'); });
               break;
            case 'cinema':
               // Laboratory cinema/media player
               const videoUrl = data.target || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
               results.innerHTML = `
                  <div class="stream-container cinema-mode">
                     <div class="stream-overlay">LAB_STREAM_ACTIVE • SOURCE: ${videoUrl.substring(0, 30)}...</div>
                     <video controls autoplay class="cyber-video">
                        <source src="${videoUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                     </video>
                     <div class="stream-stats">
                        <div>MODE: LABORATORY_RESEARCH</div>
                        <div>BUFFER: OPTIMIZED</div>
                        <div>SIGNAL: ENCRYPTED</div>
                     </div>
                  </div>
               `;
               return;
            case 'ioc':
               html += this.createStatBox('Match Found', data.match ? 'YES' : 'NO');
               html += this.createStatBox('Last Seen', data.last_seen || 'N/A');
               html += this.createStatBox('Threat Type', data.threat || 'none');
               break;
            case 'proxies':
               if (Array.isArray(data)) {
                  data.slice(0, 6).forEach(p => { html += this.createStatBox('Proxy Node', p); });
               }
               break;
         }

         html += '</div>';
         results.innerHTML = html;
      },

      renderChatUI() {
         this.viewContainer.innerHTML = `
            <div class="tool-view active chat-view">
                <h1 class="tool-title">Anonymous Lab Chat</h1>
                <p class="tool-desc">Enter a room name to join an anonymous communication channel.</p>
                
                <div class="input-group" style="display:flex; flex-direction:column; gap:0.5rem">
                    <input type="text" class="cyber-input" id="chat-nick-input" placeholder="Nickname (e.g. ghost)" value="${localStorage.getItem('cyber-nick') || ''}">
                    <div style="display:flex; gap:0.5rem">
                        <input type="text" class="cyber-input" id="chat-room-input" placeholder="Room Name (e.g. dev-lab)" style="flex:1">
                        <button class="cyber-btn" id="join-chat-btn">Connect</button>
                    </div>
                </div>

                <div id="chat-session" style="display:none">
                    <div class="chat-header">CONNECTED_TO: <span id="active-room" style="color:#fff">none</span></div>
                    <div id="chat-feed" class="chat-feed"></div>
                    <div class="chat-input-row">
                        <input type="text" class="cyber-input" id="chat-msg-input" placeholder="Type message...">
                        <button class="cyber-btn" id="send-msg-btn">Send</button>
                    </div>
                </div>
            </div>
         `;

         const joinBtn = document.getElementById('join-chat-btn');
         const roomInput = document.getElementById('chat-room-input');
         const nickInput = document.getElementById('chat-nick-input');
         const sendBtn = document.getElementById('send-msg-btn');
         const msgInput = document.getElementById('chat-msg-input');

         joinBtn.addEventListener('click', () => this.connectToRoom(roomInput.value.trim(), nickInput.value.trim()));
         roomInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.connectToRoom(roomInput.value.trim(), nickInput.value.trim()); });
         nickInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.connectToRoom(roomInput.value.trim(), nickInput.value.trim()); });

         sendBtn.addEventListener('click', () => this.sendMessage());
         msgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.sendMessage(); });
      },

      connectToRoom(room, nick) {
         if (!room) return;
         this.currentRoom = room;
         this.currentUser = nick || '';
         if (nick) localStorage.setItem('cyber-nick', nick);

         document.getElementById('chat-session').style.display = 'block';
         document.getElementById('active-room').textContent = room + (nick ? ` as ${nick}` : '');
         this.loadMessages();
         if (this.chatTimer) clearInterval(this.chatTimer);
         this.chatTimer = setInterval(() => this.loadMessages(), 2500);
      },

      async loadMessages() {
         if (!this.currentRoom) return;
         try {
            const res = await fetch(`/api/chat/messages?room=${encodeURIComponent(this.currentRoom)}`);
            const data = await res.json();
            console.log('[CyberChat] Messages received:', data);
            const feed = document.getElementById('chat-feed');
            if (!feed) return;

            const isAtBottom = feed.scrollHeight - feed.scrollTop <= feed.clientHeight + 100;

            feed.innerHTML = (data.messages || []).map(m => `
                <div class="chat-msg">
                    <span class="chat-user">[${m.user}]</span>: 
                    <span class="chat-text">${m.text}</span>
                    <span class="chat-time">${new Date(m.time).toLocaleTimeString()}</span>
                </div>
            `).join('');

            if (isAtBottom) feed.scrollTop = feed.scrollHeight;
         } catch (e) { console.error('Chat load error', e); }
      },

      async sendMessage() {
         const input = document.getElementById('chat-msg-input');
         const text = input.value.trim();
         if (!this.currentRoom || !text) return;

         input.value = '';
         try {
            const res = await fetch('/api/chat/send', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ room: this.currentRoom, message: text, user: this.currentUser })
            });
            const data = await res.json();
            console.log('[CyberChat] Send response:', data);
            this.loadMessages();
         } catch (e) { console.error('Chat send error', e); }
      },

      createStatBox(label, value) {
         return `
                <div class="stat-box">
                    <div class="stat-label">${label}</div>
                    <div class="stat-value">${value || 'N/A'}</div>
                </div>
            `;
      }
   };

   window.CyberMode = CyberMode;
})();
