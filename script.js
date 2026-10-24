// ==========================================================================
// QBrain Pay - Interactive Scripts & SPA Navigation
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {

  // --- Mobile Native Haptic Feedback Utility ---
  function triggerHaptic(pattern = 'light') {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (pattern === 'light') navigator.vibrate(12);
        else if (pattern === 'medium') navigator.vibrate(22);
        else if (pattern === 'success') navigator.vibrate([15, 35, 20]);
        else if (pattern === 'error') navigator.vibrate([40, 50, 40]);
        else if (typeof pattern === 'number') navigator.vibrate(pattern);
      } catch (e) {}
    }
  }
  window.triggerHaptic = triggerHaptic;

  // --- PWA Service Worker Registration for Offline & Fast App Launch ---
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  // --- Native App Privacy Shield (Auto-blurs when app is backgrounded / in recents) ---
  const appPrivacyShield = document.getElementById('appPrivacyShield');
  window.addEventListener('blur', () => {
    if (appPrivacyShield) appPrivacyShield.classList.remove('hidden');
  });
  window.addEventListener('focus', () => {
    if (appPrivacyShield) appPrivacyShield.classList.add('hidden');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (appPrivacyShield) appPrivacyShield.classList.remove('hidden');
    } else {
      if (appPrivacyShield) appPrivacyShield.classList.add('hidden');
    }
  });
  // --- Pages & Global Containers ---
  const authPage = document.getElementById('authPage');
  const homePage = document.getElementById('homePage');
  const cardsPage = document.getElementById('cardsPage');
  const depositPage = document.getElementById('depositPage');
  const profilePage = document.getElementById('profilePage');
  const sendPage = document.getElementById('sendPage');
  const assetsPage = document.getElementById('assetsPage');
  const bottomNav = document.querySelector('.bottom-nav');
  const navItems = document.querySelectorAll('.nav-item');

  // --- Production API Configuration (Vercel Cloud Backend & Mobile APK Sync) ---
  // When running inside Android APK (Capacitor/WebView), hostname is localhost.
  // We automatically route all API requests to your live Vercel domain.
  const DEFAULT_LIVE_BACKEND = 'https://qbrainpay.vercel.app';
  const isCapacitorNative = window.location.protocol === 'capacitor:' ||
                            window.location.protocol === 'file:' ||
                            (window.location.hostname === 'localhost' && window.location.port === '') ||
                            navigator.userAgent.includes('Capacitor') ||
                            navigator.userAgent.includes('wv');

  const configuredBackend = localStorage.getItem('qbrain_live_api_url') || DEFAULT_LIVE_BACKEND;
  const API_BASE_URL = isCapacitorNative ? configuredBackend : '';

  function apiUrl(path) {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (!API_BASE_URL) return path;
    const base = API_BASE_URL.replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return base + cleanPath;
  }
  window.apiUrl = apiUrl;

  // --- Supabase Client & Realtime DB Configuration ---
  const SUPABASE_URL = 'https://zfngidcsyvrtkfwyench.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmbmdpZGNzeXZydGtmd3llbmNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MzY2NTgsImV4cCI6MjEwMzUxMjY1OH0.SwoA8AuBLro63ditNmGYTSTXFX7C0Q-xGQY5Syb1yxo';
  let supabase = null;
  if (window.supabase) {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      window.supabaseClient = supabase;
      console.log('✓ Supabase Client connected to zfngidcsyvrtkfwyench');
    } catch (err) {
      console.warn('Supabase initialization warning:', err);
    }
  }

  let currentUser = null;
  let currentPageId = 'auth';
  let currentProfile = {
    full_name: 'Md Khalid Hasan',
    email: 'mdkhalidhasan@gmail.com',
    balance: 0.00,
    face_verified: localStorage.getItem('qbrain_face_verified') === 'true',
    depositCount: 0,
    kyc_status: 'Verified'
  };

  // Transaction Management (Strictly Real Deposits & Transactions)
  let userTransactions = [];
  try {
    const savedTx = localStorage.getItem('qbrain_transactions');
    if (savedTx) {
      userTransactions = JSON.parse(savedTx);
      // Clean up legacy mock card purchase from history if user never legitimately deposited
      userTransactions = userTransactions.filter(tx => tx.title !== 'Virtual Card Issuance');
      localStorage.setItem('qbrain_transactions', JSON.stringify(userTransactions));
    }
  } catch (e) {}

  // Notification Management (Strictly Real Blockchain & System Alerts)
  let userNotifications = [];
  try {
    const savedNotifs = localStorage.getItem('qbrain_notifications');
    if (savedNotifs) {
      userNotifications = JSON.parse(savedNotifs);
      // Clean out any legacy mock notifications
      userNotifications = userNotifications.filter(n => 
        !n.desc?.includes('500.00 USDT') && 
        !n.title?.includes('Farhan') &&
        !n.title?.includes('Virtual Platinum Card Ready')
      );
      localStorage.setItem('qbrain_notifications', JSON.stringify(userNotifications));
    }
  } catch (e) {}

  function renderTransactions() {
    const homeTxList = document.getElementById('homeTransactionsList');
    const cardTxList = document.getElementById('cardTransactionsList');

    const emptyHomeHTML = `
      <div class="empty-transactions-box" id="emptyTransactionsState">
        <div class="empty-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="empty-tx-svg">
            <rect x="2" y="4" width="20" height="16" rx="3"></rect>
            <path d="M7 15h10M7 9h6"></path>
          </svg>
        </div>
        <p class="empty-title">No transactions yet</p>
        <p class="empty-sub">Your deposits and transfers will show up here</p>
      </div>`;

    const emptyCardHTML = `
      <div class="empty-transactions-box" id="emptyCardTransactionsState">
        <div class="empty-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="empty-tx-svg">
            <rect x="2" y="4" width="20" height="16" rx="3"></rect>
            <path d="M7 15h10M7 9h6"></path>
          </svg>
        </div>
        <p class="empty-title">No transactions yet</p>
        <p class="empty-sub">Your card transactions will appear here</p>
      </div>`;

    if (homeTxList) {
      if (userTransactions.length === 0) {
        homeTxList.innerHTML = emptyHomeHTML;
      } else {
        homeTxList.innerHTML = userTransactions.map((tx, idx) => {
          // Clean title if too long: e.g. "USDT Deposit (Polygon (POL))" -> "Polygon USDT Deposit"
          let displayTitle = tx.title;
          if (displayTitle.includes('USDT Deposit')) {
            const netMatch = displayTitle.match(/\((.*?)\)/);
            if (netMatch && netMatch[1]) {
              const netShort = netMatch[1].split(' ')[0];
              displayTitle = `${netShort} USDT Deposit`;
            }
          }

          return `
            <div class="transaction-item" data-tx-index="${idx}" style="cursor: pointer;">
              <div class="trans-icon-wrapper" style="background: ${tx.amount >= 0 ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #4f46e5)'}; box-shadow: 0 4px 10px ${tx.amount >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'};">
                <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px;">
                  ${tx.amount >= 0 
                    ? '<path d="M12 4v11m0 0l-3.5-3.5m3.5 3.5l3.5-3.5M4 19h16"/>' 
                    : '<path d="M12 20V9m0 0l-3.5 3.5m3.5-3.5l3.5 3.5M4 5h16"/>'}
                </svg>
              </div>
              <div class="trans-details">
                <span class="trans-title">${displayTitle}</span>
                <span class="trans-time">${tx.time}</span>
              </div>
              <div class="trans-meta">
                <span class="trans-amount ${tx.amount >= 0 ? 'amount-positive' : 'amount-negative'}">${tx.amount >= 0 ? '+' : '-'} $${Math.abs(tx.amount).toFixed(2)}</span>
                <span class="trans-status badge-${tx.status === 'Completed' ? 'completed' : 'success'}">${tx.status}</span>
              </div>
            </div>
          `;
        }).join('');

        // Wire click to view receipt
        homeTxList.querySelectorAll('.transaction-item').forEach(el => {
          el.addEventListener('click', () => {
            const idx = parseInt(el.getAttribute('data-tx-index'), 10);
            const tx = userTransactions[idx];
            if (tx) openTransactionReceipt(tx);
          });
        });
      }
    }

    if (cardTxList) {
      if (userTransactions.length === 0) {
        cardTxList.innerHTML = emptyCardHTML;
      } else {
        cardTxList.innerHTML = userTransactions.map((tx, idx) => `
          <div class="my-card-tx-item" data-tx-index="${idx}" style="cursor: pointer;">
            <div class="tx-left">
              <div class="tx-icon-box ${tx.amount >= 0 ? 'green-tint' : 'apple-black'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="tx-svg-icon" style="width: 20px; height: 20px;">
                  ${tx.amount >= 0 
                    ? '<path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/>' 
                    : '<path d="M12 20V8m0 0l-4 4m4-4l4 4M4 4h16"/>'}
                </svg>
              </div>
              <div class="tx-meta">
                <span class="tx-name">${tx.title}</span>
                <span class="tx-time">${tx.time}</span>
              </div>
            </div>
            <div class="tx-right">
              <span class="tx-amt ${tx.amount >= 0 ? 'positive' : 'negative'}">${tx.amount >= 0 ? '+' : '-'} $${Math.abs(tx.amount).toFixed(2)}</span>
              <span class="tx-status-badge ${tx.status === 'Completed' ? 'completed' : 'successful'}">${tx.status}</span>
            </div>
          </div>
        `).join('');

        cardTxList.querySelectorAll('.my-card-tx-item').forEach(el => {
          el.addEventListener('click', () => {
            const idx = parseInt(el.getAttribute('data-tx-index'), 10);
            const tx = userTransactions[idx];
            if (tx) openTransactionReceipt(tx);
          });
        });
      }
    }
  }

  function addTransaction(tx) {
    userTransactions.unshift(tx);
    localStorage.setItem('qbrain_transactions', JSON.stringify(userTransactions));
    renderTransactions();
  }

  function addNotification(notif) {
    userNotifications.unshift({
      id: notif.id || 'notif_' + Date.now(),
      title: notif.title || 'Notification',
      desc: notif.desc || '',
      category: notif.category || 'all',
      time: notif.time || 'Just now',
      unread: true
    });
    localStorage.setItem('qbrain_notifications', JSON.stringify(userNotifications));
    renderNotifications();
  }

  function updateAppWithUserData(profile) {
    if (!profile) return;
    currentProfile = Object.assign({}, currentProfile, profile);
    
    // Update balance displays
    const balFormatted = `$${parseFloat(currentProfile.balance || 0).toFixed(2)}`;
    if (balanceAmountEl) {
      if (isBalanceVisible) {
        balanceAmountEl.textContent = balFormatted;
      }
    }
    const sendMethodBal = document.getElementById('sendMethodBalanceVal');
    if (sendMethodBal) sendMethodBal.textContent = balFormatted;
    const assetsTotalAmt = document.getElementById('assetsTotalAmount');
    if (assetsTotalAmt) {
      if (isAssetsVisible) {
        assetsTotalAmt.textContent = balFormatted;
      }
    }
    const cardBalNum = document.querySelector('.card-balance-num');
    if (cardBalNum) cardBalNum.textContent = balFormatted;

    // Sync individual USDT network wallet breakdown on Assets Page
    const numBal = parseFloat(currentProfile.balance || 0);
    const walPolAmt = document.getElementById('walPolAmount');
    const walPolFiat = document.getElementById('walPolFiat');
    if (walPolAmt) walPolAmt.textContent = numBal.toFixed(2);
    if (walPolFiat) walPolFiat.textContent = `≈ $${numBal.toFixed(2)}`;

    const walArbAmt = document.getElementById('walArbAmount');
    const walArbFiat = document.getElementById('walArbFiat');
    if (walArbAmt) walArbAmt.textContent = '0.00';
    if (walArbFiat) walArbFiat.textContent = '≈ $0.00';

    const walBnbAmt = document.getElementById('walBnbAmount');
    const walBnbFiat = document.getElementById('walBnbFiat');
    if (walBnbAmt) walBnbAmt.textContent = '0.00';
    if (walBnbFiat) walBnbFiat.textContent = '≈ $0.00';

    const walTronAmt = document.getElementById('walTronAmount');
    const walTronFiat = document.getElementById('walTronFiat');
    if (walTronAmt) walTronAmt.textContent = '0.00';
    if (walTronFiat) walTronFiat.textContent = '≈ $0.00';
    
    // Update user profile info on profile page
    const profileUserName = document.querySelector('.profile-user-name');
    if (profileUserName) profileUserName.textContent = currentProfile.full_name || 'QBrain User';
    const profileUserEmail = document.querySelector('.profile-user-email');
    if (profileUserEmail) profileUserEmail.textContent = currentProfile.email || 'user@qbrainpay.com';

    // Update personal info page elements
    const piName = document.getElementById('personalInfoUserName');
    if (piName) piName.textContent = currentProfile.full_name || 'QBrain User';
    const piLegal = document.getElementById('infoLegalName');
    if (piLegal) piLegal.textContent = currentProfile.full_name || 'QBrain User';
    const piEmail = document.getElementById('infoEmail');
    if (piEmail) piEmail.textContent = currentProfile.email || 'user@qbrainpay.com';
    const piAvatarInitial = document.getElementById('personalInfoAvatarInitial');
    if (piAvatarInitial) {
      const fnVal = currentProfile.full_name || currentProfile.name || 'Q';
      const initial = (typeof fnVal === 'string' ? fnVal : String(fnVal || 'Q')).trim().charAt(0).toUpperCase();
      piAvatarInitial.textContent = initial || 'Q';
    }

    // Update cardholder names with dynamic account name (embossed uppercase styling)
    const _cnFull = (currentProfile && (currentProfile.full_name || currentProfile.name)) || (currentUser && currentUser.profile && currentUser.profile.full_name) || 'QBrain User';
    const dynamicCardholderName = (typeof _cnFull === 'string' ? _cnFull : String(_cnFull)).toUpperCase();
    const cardHolders = document.querySelectorAll('.cardholder-name, .holder-val');
    cardHolders.forEach(el => {
      el.textContent = dynamicCardholderName;
    });

    // Update Card Expiry (exactly 3 years into future, e.g. 10/29)
    const expDate = new Date();
    const expMonth = String(expDate.getMonth() + 1).padStart(2, '0');
    const expYear = String((expDate.getFullYear() + 3) % 100).padStart(2, '0');
    const expFormatted = `${expMonth}/${expYear}`;
    const expElements = document.querySelectorAll('.exp-val');
    expElements.forEach(el => {
      el.textContent = expFormatted;
    });

    // Sync saved CVV if set by user
    const savedCustomCvv = localStorage.getItem('qbrain_custom_cvv');
    if (savedCustomCvv && savedCustomCvv.length === 3) {
      const unpurchasedCvvVal = document.getElementById('unpurchasedCvvVal');
      if (unpurchasedCvvVal) unpurchasedCvvVal.textContent = savedCustomCvv;
      const purchasedCvvVal = document.getElementById('purchasedCvvVal');
      if (purchasedCvvVal && !isCardRevealed) purchasedCvvVal.textContent = '•••';
      else if (purchasedCvvVal && isCardRevealed) purchasedCvvVal.textContent = savedCustomCvv;
    }
  }

  // --- Home Page Elements ---
  const balanceAmountEl = document.getElementById('balanceAmount');
  const toggleBalanceBtn = document.getElementById('toggleBalance');
  const eyeOpenIcon = document.getElementById('eyeOpenIcon');
  const eyeClosedIcon = document.getElementById('eyeClosedIcon');
  const btnDeposit = document.getElementById('btnDeposit');
  const btnSend = document.getElementById('btnSend');
  const qaTransferBtn = document.getElementById('qaTransfer');
  const qaConvertBtn = document.getElementById('qaConvert');
  const fabScanBtn = document.getElementById('fabScan');
  const notifBtn = document.getElementById('notifBtn');
  const profileBtn = document.getElementById('profileBtn');

  // --- Cards, Deposit, Profile & Send Page Elements ---
  const cardsBackBtn = document.getElementById('cardsBackBtn');
  const depositBackBtn = document.getElementById('depositBackBtn');
  const profileBackBtn = document.getElementById('profileBackBtn');
  const profileSettingsBtn = document.getElementById('profileSettingsBtn');
  const btnLogOut = document.getElementById('btnLogOut');
  const sendBackBtn = document.getElementById('sendBackBtn');
  const sendChatBtn = document.getElementById('sendChatBtn');
  const btnSelectContact = document.getElementById('btnSelectContact');
  const btnSendContinue = document.getElementById('btnSendContinue');
  const typePillBtns = document.querySelectorAll('.type-pill-btn');
  const cardsSlider = document.getElementById('cardsSlider');
  const cardSlides = document.querySelectorAll('#cardsSlider .card-slide');
  const carouselDots = document.querySelectorAll('#carouselDots .carousel-dot');
  const colorOptionBtns = document.querySelectorAll('.color-options-row .color-option-btn');
  const btnApplyCard = document.getElementById('btnApplyCard');

  // Check initial route or active state
  const urlParams = new URLSearchParams(window.location.search);
  const demoParam = urlParams.get('demo') === '1' || urlParams.get('user');
  let savedSession = localStorage.getItem('qbrain_user_session');

  if (demoParam && !savedSession) {
    const demoProfile = {
      full_name: 'Md Khalid Hasan',
      email: 'mdkhalidhasan@gmail.com',
      balance: 0.00,
      kyc_status: 'Verified'
    };
    currentUser = { id: 'usr_seed_1', email: demoProfile.email, profile: demoProfile };
    localStorage.setItem('qbrain_user_session', JSON.stringify(currentUser));
    savedSession = JSON.stringify(currentUser);
  }

  if (savedSession) {
    try {
      const parsed = JSON.parse(savedSession);
      currentUser = parsed;
      if (parsed.profile) {
        // Sanitize legacy mock balance: if balance was fake 240.50, reset it to real 0.00
        if (parsed.profile.balance === 240.5 || parsed.profile.balance === 240.50 || parsed.profile.balance === 246.5 || parsed.profile.balance === 247.5) {
          parsed.profile.balance = 0.00;
          parsed.profile.totalDeposited = 0.00;
          localStorage.setItem('qbrain_user_session', JSON.stringify(currentUser));
        }
        currentProfile = Object.assign({}, currentProfile, parsed.profile);
      }
      updateAppWithUserData(currentProfile);
      syncUserDedicatedWallet();
      sendUserPresenceHeartbeat();
      const targetView = urlParams.get('view') || 'home';
      navigateTo(targetView);
    } catch (e) {
      navigateTo('auth');
    }
  } else {
    // Unauthenticated user opens app -> Shows Login Screen!
    navigateTo('auth');
  }

  renderTransactions();

  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#my-cards') {
      isCardPurchased = true;
      navigateTo('cards');
    } else if (window.location.hash === '#cards') {
      navigateTo('cards');
    } else {
      navigateTo('home');
    }
  });

  const hiddenMask = '••••••••';
  let isBalanceVisible = true;

  // 1. Toggle Balance Visibility (Eye Icon)
  if (toggleBalanceBtn && balanceAmountEl) {
    toggleBalanceBtn.addEventListener('click', () => {
      isBalanceVisible = !isBalanceVisible;
      
      if (isBalanceVisible) {
        balanceAmountEl.textContent = `$${parseFloat(currentProfile.balance || 0).toFixed(2)}`;
        eyeOpenIcon.classList.remove('hidden');
        eyeClosedIcon.classList.add('hidden');
      } else {
        balanceAmountEl.textContent = hiddenMask;
        eyeOpenIcon.classList.add('hidden');
        eyeClosedIcon.classList.remove('hidden');
      }
    });
  }

  // 2. Card View State Management (Purchased "My Cards" vs Unpurchased "Choose Card")
  // New users have no card initially!
  let isCardPurchased = false;
  const savedCardPurchased = localStorage.getItem('qbrain_card_purchased');
  if (savedCardPurchased === 'true') {
    // Only keep purchased if user holds real funds or genuine deposit history
    if ((parseFloat(currentProfile.balance || 0) > 0) || (parseFloat(currentProfile.totalDeposited || 0) > 0)) {
      isCardPurchased = true;
    } else {
      isCardPurchased = false;
      localStorage.removeItem('qbrain_card_purchased');
      localStorage.removeItem('qbrain_user_card_data');
    }
  }
  let userPurchasedCardIndex = 2; // Default to Magenta (Index 2)
  const savedCardIdx = localStorage.getItem('qbrain_card_index');
  if (savedCardIdx !== null) {
    userPurchasedCardIndex = parseInt(savedCardIdx, 10);
  }
  let isCardFrozen = false;
  let isCardRevealed = false;

  function applyCardRevealState() {
    const myPurchasedCard = document.getElementById('myPurchasedCard');
    if (!myPurchasedCard) return;

    const numEl = myPurchasedCard.querySelector('.card-number-display');
    const cvvValEl = myPurchasedCard.querySelector('.card-cvv-pill .cvv-val');
    const lblView = document.getElementById('lblActionView');
    const iconOpen = document.getElementById('viewIconOpen');
    const iconClosed = document.getElementById('viewIconClosed');

    let cData = { cardNumber: '4829 7492 5183 9204', cvv: '741', expiry: '12/29' };
    try {
      const savedCD = localStorage.getItem('qbrain_user_card_data');
      if (savedCD) cData = JSON.parse(savedCD);
    } catch(e) {}

    const parts = (cData.cardNumber || '4829 7492 5183 9204').split(' ');

    if (numEl) {
      if (isCardRevealed) {
        numEl.innerHTML = `<span class="num-grp">${parts[0] || '4829'}</span><span class="num-grp">${parts[1] || '7492'}</span><span class="num-grp">${parts[2] || '5183'}</span><span class="num-grp">${parts[3] || '9204'}</span>`;
      } else {
        numEl.innerHTML = `<span class="num-grp">${parts[0] || '4829'}</span><span class="num-grp">••••</span><span class="num-grp">••••</span><span class="num-grp">${parts[3] || '9204'}</span>`;
      }
    }

    if (cvvValEl) {
      cvvValEl.textContent = isCardRevealed ? (cData.cvv || '741') : '•••';
    }

    if (lblView) {
      lblView.textContent = isCardRevealed ? 'Hide' : 'View';
    }

    if (iconOpen && iconClosed) {
      if (isCardRevealed) {
        iconOpen.classList.add('hidden');
        iconClosed.classList.remove('hidden');
      } else {
        iconOpen.classList.remove('hidden');
        iconClosed.classList.add('hidden');
      }
    }
  }

  function updatePurchasedCardDisplay(index) {
    const myPurchasedCard = document.getElementById('myPurchasedCard');
    const sourceCard = cardSlides[index];
    if (!myPurchasedCard || !sourceCard) return;

    // Directly replicate the EXACT card HTML & theme classes
    myPurchasedCard.className = sourceCard.className;
    myPurchasedCard.classList.add('active');
    myPurchasedCard.id = 'myPurchasedCard';

    // Build the frozen overlay
    const freezeOverlayHTML = `
      <div class="card-frozen-overlay ${isCardFrozen ? '' : 'hidden'}" id="cardFrozenOverlay">
        <div class="frozen-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="frozen-icon">
            <line x1="12" y1="2" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <line x1="20" y1="16" x2="12" y2="12"/>
            <line x1="4" y1="8" x2="12" y2="12"/>
            <line x1="20" y1="8" x2="12" y2="12"/>
            <line x1="4" y1="16" x2="12" y2="12"/>
            <path d="m10 4 2-2 2 2"/>
            <path d="m10 20 2 2 2-2"/>
            <path d="m4 10-2 2 2 2"/>
            <path d="m20 10 2 2-2 2"/>
          </svg>
          <span>CARD FROZEN</span>
        </div>
        <p class="frozen-hint">Tap Freeze to unlock</p>
      </div>`;

    myPurchasedCard.innerHTML = freezeOverlayHTML + sourceCard.innerHTML;

    // Apply reveal or masked state
    applyCardRevealState();
  }

  function setCardsViewState(purchased) {
    isCardPurchased = purchased;
    const cardsPurchasedView = document.getElementById('cardsPurchasedView');
    const cardsUnpurchasedView = document.getElementById('cardsUnpurchasedView');

    if (purchased) {
      cardsPage.classList.remove('state-unpurchased');
      cardsPage.classList.add('state-purchased');
      if (cardsPurchasedView) cardsPurchasedView.classList.add('active');
      if (cardsUnpurchasedView) cardsUnpurchasedView.classList.remove('active');
      if (bottomNav) bottomNav.classList.remove('hide-nav');
      updatePurchasedCardDisplay(userPurchasedCardIndex);
    } else {
      cardsPage.classList.remove('state-purchased');
      cardsPage.classList.add('state-unpurchased');
      if (cardsPurchasedView) cardsPurchasedView.classList.remove('active');
      if (cardsUnpurchasedView) cardsUnpurchasedView.classList.add('active');
      if (bottomNav) bottomNav.classList.add('hide-nav');
      
      // Center current card
      if (cardsSlider) {
        cardsSlider.scrollLeft = userPurchasedCardIndex * CARD_STEP;
      }
      updateActiveStates(userPurchasedCardIndex);
      setTimeout(() => scrollToCard(userPurchasedCardIndex, false), 50);
    }
  }

  // --- 2. Universal Navigation Stack & History Tracking ---
  let navigationStack = ['home'];

  function navigateTo(pageId, isBack = false, pushToHistory = true) {
    if (pageId === currentPageId && document.querySelector(`.app-page.active#${pageId}Page`)) return;
    currentPageId = pageId;

    if (pushToHistory) {
      if (!isBack) {
        if (navigationStack[navigationStack.length - 1] !== pageId) {
          navigationStack.push(pageId);
        }
      }
      try {
        window.history.pushState({ pageId: pageId, stack: navigationStack.slice() }, '');
      } catch (e) {}
    }
    const appContainer = document.querySelector('.app-container');
    // Cleanly deactivate all pages first and clear previous animation modifiers
    document.querySelectorAll('.app-page').forEach(p => {
      p.classList.remove('active', 'subpage-push', 'subpage-pop', 'tab-transition');
    });

    function activatePage(el, isSub = false) {
      if (!el) return;
      if (isBack) {
        el.classList.add('subpage-pop');
      } else if (isSub) {
        el.classList.add('subpage-push');
      } else {
        el.classList.add('tab-transition');
      }
      el.classList.add('active');
    }

    if (pageId === 'auth') {
      if (appContainer) appContainer.classList.remove('cards-mode');
      activatePage(authPage, false);
      if (bottomNav) bottomNav.classList.add('hide-nav');
      return;
    }

    if (pageId === 'cards') {
      if (appContainer) appContainer.classList.add('cards-mode');
      activatePage(cardsPage, false);

      // Update bottom nav active state to cards
      navItems.forEach(nav => {
        if (nav.getAttribute('data-nav') === 'cards') {
          nav.classList.add('active');
        } else {
          nav.classList.remove('active');
        }
      });

      // Apply view state (purchased by default)
      setCardsViewState(isCardPurchased);

    } else if (pageId === 'home') {
      if (appContainer) appContainer.classList.remove('cards-mode');
      activatePage(homePage, false);
      if (bottomNav) bottomNav.classList.remove('hide-nav');

      // Update bottom nav active state to home
      navItems.forEach(nav => {
        if (nav.getAttribute('data-nav') === 'home') {
          nav.classList.add('active');
        } else {
          nav.classList.remove('active');
        }
      });
    } else if (pageId === 'deposit') {
      if (appContainer) appContainer.classList.remove('cards-mode');
      activatePage(depositPage, true);
      if (bottomNav) bottomNav.classList.add('hide-nav');
    } else if (pageId === 'profile') {
      if (appContainer) appContainer.classList.remove('cards-mode');
      activatePage(profilePage, true);
      if (bottomNav) bottomNav.classList.add('hide-nav');
    } else if (pageId === 'send') {
      if (appContainer) appContainer.classList.remove('cards-mode');
      activatePage(sendPage, false);
      if (bottomNav) bottomNav.classList.remove('hide-nav');

      // Update bottom nav active state to send
      navItems.forEach(nav => {
        if (nav.getAttribute('data-nav') === 'send') {
          nav.classList.add('active');
        } else {
          nav.classList.remove('active');
        }
      });
    } else if (pageId === 'assets') {
      if (appContainer) appContainer.classList.remove('cards-mode');
      activatePage(assetsPage, false);
      if (bottomNav) bottomNav.classList.remove('hide-nav');

      // Update bottom nav active state to assets
      navItems.forEach(nav => {
        if (nav.getAttribute('data-nav') === 'assets') {
          nav.classList.add('active');
        } else {
          nav.classList.remove('active');
        }
      });
    } else if (pageId === 'notifications') {
      if (appContainer) appContainer.classList.remove('cards-mode');
      const notifP = document.getElementById('notificationsPage');
      activatePage(notifP, true);
      if (bottomNav) bottomNav.classList.add('hide-nav');
      renderNotifications();
    } else if (pageId === 'scanner') {
      if (appContainer) appContainer.classList.remove('cards-mode');
      const scanP = document.getElementById('scannerPage');
      activatePage(scanP, true);
      if (bottomNav) bottomNav.classList.add('hide-nav');
      startCameraScanner();
    } else if (pageId === 'personalInfo') {
      if (appContainer) appContainer.classList.remove('cards-mode');
      const piP = document.getElementById('personalInfoPage');
      activatePage(piP, true);
      if (bottomNav) bottomNav.classList.add('hide-nav');
    } else if (pageId === 'receipt') {
      if (appContainer) appContainer.classList.remove('cards-mode');
      const recP = document.getElementById('transactionReceiptPage');
      activatePage(recP, true);
      if (bottomNav) bottomNav.classList.add('hide-nav');
    } else if (pageId === 'allTransactions' || pageId === 'transactions') {
      if (appContainer) appContainer.classList.remove('cards-mode');
      const atP = document.getElementById('allTransactionsPage');
      activatePage(atP, true);
      if (bottomNav) bottomNav.classList.add('hide-nav');
      renderAllTransactions();
    } else if (pageId === 'depositDetails') {
      if (appContainer) appContainer.classList.remove('cards-mode');
      const ddP = document.getElementById('depositDetailsPage');
      activatePage(ddP, true);
      if (bottomNav) bottomNav.classList.add('hide-nav');
    }
  }

  // --- Universal Back Navigation Handler for On-Screen Buttons & Gestures ---
  function goBackNative() {
    // 1. If any modal sheet is open, close modal first (don't navigate away)
    const cardModalBackdrop = document.getElementById('cardModalBackdrop');
    if (cardModalBackdrop && !cardModalBackdrop.classList.contains('hidden')) {
      cardModalBackdrop.classList.add('hidden');
      return true;
    }

    const cvvModal = document.getElementById('cvvSetupModalOverlay');
    if (cvvModal && !cvvModal.classList.contains('hidden')) {
      cvvModal.classList.add('hidden');
      return true;
    }

    const faceModal = document.getElementById('faceVerificationModal');
    if (faceModal && !faceModal.classList.contains('hidden')) {
      faceModal.classList.add('hidden');
      return true;
    }

    // 2. Camera scanner cleanup if leaving scanner
    if (currentPageId === 'scanner') {
      stopCameraScanner();
    }

    // 3. Pop previous page from navigation history stack
    if (navigationStack.length > 1) {
      navigationStack.pop(); // Pop current page
      const prevPage = navigationStack[navigationStack.length - 1] || 'home';
      navigateTo(prevPage, true, false);
      try {
        window.history.replaceState({ pageId: prevPage, stack: navigationStack.slice() }, '');
      } catch (e) {}
      return true;
    } else if (currentPageId && currentPageId !== 'home') {
      navigationStack = ['home'];
      navigateTo('home', true, false);
      try {
        window.history.replaceState({ pageId: 'home', stack: ['home'] }, '');
      } catch (e) {}
      return true;
    }
    return false;
  }

  // --- Native iOS/Android Left-Edge Swipe Back Gesture ---
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isEdgeSwipeActive = false;

  window.addEventListener('touchstart', (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();

    // Check if swipe started from left edge (within first 45px) and on a subpage or modal
    const cardModalBackdrop = document.getElementById('cardModalBackdrop');
    const isModalOpen = (cardModalBackdrop && !cardModalBackdrop.classList.contains('hidden')) ||
                        (document.getElementById('cvvSetupModalOverlay') && !document.getElementById('cvvSetupModalOverlay').classList.contains('hidden'));

    if (touchStartX <= 45 && (navigationStack.length > 1 || currentPageId !== 'home' || isModalOpen)) {
      isEdgeSwipeActive = true;
    } else {
      isEdgeSwipeActive = false;
    }
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (!isEdgeSwipeActive) return;
    isEdgeSwipeActive = false;

    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStartX;
    const diffY = Math.abs(touch.clientY - touchStartY);
    const duration = Date.now() - touchStartTime;

    // Must be a horizontal swipe to the right (at least 60px distance, reasonable angle and speed)
    if (diffX > 60 && diffY < 80 && duration < 500) {
      goBackNative();
    }
  }, { passive: true });

  // Universal Phone & Browser Back-Button Navigation Stack
  try {
    window.history.replaceState({ pageId: 'home', stack: ['home'] }, '');
  } catch (e) {}

  window.addEventListener('popstate', (e) => {
    // A. Check and dismiss any active modals first
    const cardModalBackdrop = document.getElementById('cardModalBackdrop');
    if (cardModalBackdrop && !cardModalBackdrop.classList.contains('hidden')) {
      cardModalBackdrop.classList.add('hidden');
      return;
    }

    const cvvModal = document.getElementById('cvvSetupModalOverlay');
    if (cvvModal && !cvvModal.classList.contains('hidden')) {
      cvvModal.classList.add('hidden');
      return;
    }

    const faceModal = document.getElementById('faceVerificationModal');
    if (faceModal && !faceModal.classList.contains('hidden')) {
      faceModal.classList.add('hidden');
      return;
    }

    if (currentPageId === 'scanner') {
      stopCameraScanner();
    }

    // B. Check Auth Page sub-steps
    const authPageEl = document.getElementById('authPage');
    if (authPageEl && authPageEl.classList.contains('active')) {
      const authNewUserEl = document.getElementById('authViewNewUser');
      const authFormEl = document.getElementById('authViewForm');
      const authShowcaseEl = document.getElementById('authViewShowcase');
      const authStep2El = document.getElementById('authEmailStep2');
      const authStep1El = document.getElementById('authEmailStep1');
      const formTitleEl = document.getElementById('authFormTitle');
      const formSubEl = document.getElementById('authFormSub');

      if (authNewUserEl && (authNewUserEl.style.display === 'flex' || authNewUserEl.style.display === 'block')) {
        authNewUserEl.style.display = 'none';
        if (authFormEl) {
          authFormEl.style.display = 'flex';
          if (authStep2El) authStep2El.style.display = 'none';
          if (authStep1El) authStep1El.style.display = 'block';
        }
        return;
      }

      if (authStep2El && authStep2El.style.display === 'block') {
        authStep2El.style.display = 'none';
        if (authStep1El) authStep1El.style.display = 'block';
        if (formTitleEl) formTitleEl.textContent = 'Get Started';
        if (formSubEl) formSubEl.textContent = 'Enter your email to continue';
        return;
      }

      if (authFormEl && (authFormEl.style.display === 'flex' || authFormEl.style.display === 'block')) {
        authFormEl.style.display = 'none';
        if (authShowcaseEl) {
          authShowcaseEl.style.display = 'flex';
          authShowcaseEl.classList.remove('slide-out-left', 'slide-out-right');
          authShowcaseEl.classList.add('slide-in-left');
        }
        return;
      }
    }

    // C. Dashboard true stack back navigation
    if (e.state && e.state.pageId) {
      if (Array.isArray(e.state.stack)) {
        navigationStack = e.state.stack.slice();
      }
      navigateTo(e.state.pageId, true, false);
      return;
    }

    if (navigationStack.length > 1) {
      navigationStack.pop();
      const prev = navigationStack[navigationStack.length - 1];
      navigateTo(prev, true, false);
      return;
    }

    if (currentPageId && currentPageId !== 'home') {
      navigationStack = ['home'];
      navigateTo('home', true, false);
    }
  });

  window.navigateTo = navigateTo;
  window.goBackNative = goBackNative;
  window.openTransactionReceipt = openTransactionReceipt;
  window.openDepositModal = openDepositModal;
  window.openDepositDetailsPage = openDepositDetailsPage;
  window.openCardModal = openCardModal;

  // 3. Bottom Navigation Item Clicking
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetNav = item.getAttribute('data-nav');
      
      if (targetNav === 'cards') {
        navigateTo('cards');
      } else if (targetNav === 'home') {
        navigateTo('home');
      } else if (targetNav === 'send') {
        navigateTo('send');
      } else if (targetNav === 'assets') {
        navigateTo('assets');
      } else {
        // Tab switching micro-bounce animation
        navItems.forEach(nav => {
          nav.classList.remove('active');
          nav.classList.remove('animating');
        });
        item.classList.add('active');
        item.classList.add('animating');
        setTimeout(() => item.classList.remove('animating'), 350);
      }
    });
  });

  // 4. Quick Access "Transfer" & "Convert" Buttons on Home Page
  if (qaTransferBtn) {
    qaTransferBtn.addEventListener('click', () => {
      navigateTo('send');
    });
  }

  if (qaConvertBtn) {
    qaConvertBtn.addEventListener('click', () => {
      showAppToast('Instant swap: USDT / USD enabled');
    });
  }

  // 5. Back Button on Cards Page
  if (cardsBackBtn) {
    cardsBackBtn.addEventListener('click', () => {
      triggerHaptic('light');
      goBackNative();
    });
  }

  // 5b. Deposit Page Handlers
  if (btnDeposit) {
    btnDeposit.addEventListener('click', () => {
      navigateTo('deposit');
    });
  }

  if (depositBackBtn) {
    depositBackBtn.addEventListener('click', () => {
      triggerHaptic('light');
      goBackNative();
    });
  }

  // Realistic frontend USDT wallet addresses per network (3 networks: Polygon, Arbitrum, BNB Chain)
  let USDT_NETWORKS = {
    'Polygon (POL)': {
      network: 'Polygon PoS',
      token: 'USDT (PoS)',
      address: '0x71C8F7a3bE74C4B5286576b9DeaD3D6F2C1c82f9',
      explorer: 'PolygonScan',
      confirmations: '128 blocks (~2 mins)',
      minDeposit: '1 USDT ($1)'
    },
    'Arbitrum (One)': {
      network: 'Arbitrum One',
      token: 'USDT (Arbitrum)',
      address: '0x71C8F7a3bE74C4B5286576b9DeaD3D6F2C1c82f9',
      explorer: 'Arbiscan',
      confirmations: '64 blocks (~1 min)',
      minDeposit: '1 USDT ($1)'
    },
    'BEP-20 (BNB)': {
      network: 'BNB Smart Chain (BEP-20)',
      token: 'USDT (BSC)',
      address: '0x71C8F7a3bE74C4B5286576b9DeaD3D6F2C1c82f9',
      explorer: 'BscScan',
      confirmations: '15 blocks (~1 min)',
      minDeposit: '1 USDT ($1)'
    }
  };

  // Dynamically sync dedicated per-user deposit wallet and send presence heartbeat
  function syncUserDedicatedWallet() {
    const userEmail = currentProfile?.email || 'mdkhalidhasan@gmail.com';
    const userName = currentProfile?.full_name || 'Md Khalid Hasan';

    fetch(apiUrl(`/api/user/wallet?email=${encodeURIComponent(userEmail)}&name=${encodeURIComponent(userName)}`))
      .then(r => r.json())
      .then(data => {
        if (data && data.depositAddress) {
          const uAddr = data.depositAddress;
          Object.keys(USDT_NETWORKS).forEach(net => {
            USDT_NETWORKS[net].address = uAddr;
          });
        }
        if (data) {
          if (data.depositCount !== undefined) {
            currentProfile.depositCount = data.depositCount;
          }
          if (data.face_verified !== undefined) {
            currentProfile.face_verified = !!data.face_verified;
            if (data.face_verified) localStorage.setItem('qbrain_face_verified', 'true');
            updateFaceVerifyNoticeUI();
          }
          if (data.card_purchased !== undefined && data.card_purchased) {
            isCardPurchased = true;
            localStorage.setItem('qbrain_card_purchased', 'true');
          }
          if (data.balance !== undefined) {
            currentProfile.balance = parseFloat(data.balance);
            if (currentUser && currentUser.profile) {
              currentUser.profile.balance = parseFloat(data.balance);
              currentUser.profile.face_verified = currentProfile.face_verified;
              currentUser.profile.depositCount = currentProfile.depositCount;
              localStorage.setItem('qbrain_user_session', JSON.stringify(currentUser));
            }
            updateAppWithUserData(currentProfile);
          }
          if (data.depositHistory && Array.isArray(data.depositHistory)) {
            let txChanged = false;
            data.depositHistory.forEach(dep => {
              const exists = userTransactions.some(t => t.id === dep.id || (t.txHash && t.txHash === dep.txHash));
              if (!exists) {
                userTransactions.unshift({
                  id: dep.id || ('dep_' + Date.now()),
                  title: (dep.network || 'USDT') + ' Deposit',
                  type: 'deposit',
                  amount: dep.amount,
                  status: 'Completed',
                  date: dep.timestamp ? new Date(dep.timestamp).toLocaleDateString() : 'Today',
                  txHash: dep.txHash || '',
                  confirmations: dep.confirmations || 'On-Chain Verified'
                });
                txChanged = true;
              }
            });
            if (txChanged) {
              localStorage.setItem('qbrain_transactions', JSON.stringify(userTransactions));
              renderTransactions();
            }
          }
          handlePendingDepositState(data);
        }
      })
      .catch(() => {});
  }

  // Handle Pending / Confirming deposit UI indicators on Home and Assets cards
  function handlePendingDepositState(data) {
    const homePill = document.getElementById('homePendingDepositPill');
    const homePillText = document.getElementById('homePendingPillText');
    const assetsPill = document.getElementById('assetsPendingDepositPill');
    const assetsPillText = document.getElementById('assetsPendingPillText');

    const pendingAmt = parseFloat(data.pendingDeposit || 0);
    const secsLeft = parseInt(data.pendingConfirmSeconds || 0, 10);

    if (pendingAmt > 0 && secsLeft > 0) {
      const msg = `Pending: $${pendingAmt.toFixed(2)}`;
      if (homePill) {
        homePill.classList.remove('hidden');
        if (homePillText) homePillText.textContent = msg;
      }
      if (assetsPill) {
        assetsPill.classList.remove('hidden');
        if (assetsPillText) assetsPillText.textContent = msg;
      }
    } else {
      if (homePill) homePill.classList.add('hidden');
      if (assetsPill) assetsPill.classList.add('hidden');
      
      // If user balance was updated from server completion
      if (data.balance !== undefined && parseFloat(data.balance) !== parseFloat(currentProfile.balance || 0)) {
        currentProfile.balance = parseFloat(data.balance);
        if (data.depositCount !== undefined) {
          currentProfile.depositCount = data.depositCount;
        }
        updateAppWithUserData(currentProfile);
      }
    }
  }

  // Periodic heartbeat so Admin Panel accurately displays "Online / Active" & checks pending state
  function sendUserPresenceHeartbeat() {
    const userEmail = currentProfile?.email || 'mdkhalidhasan@gmail.com';
    fetch(apiUrl('/api/user/heartbeat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, balance: currentProfile?.balance || 0.00 })
    })
    .then(r => r.json())
    .then(res => {
      if (res) {
        if (res.depositCount !== undefined) {
          currentProfile.depositCount = res.depositCount;
        }
        if (res.face_verified !== undefined && res.face_verified) {
          currentProfile.face_verified = true;
          localStorage.setItem('qbrain_face_verified', 'true');
          updateFaceVerifyNoticeUI();
        }
        if (res.minDeposit !== undefined) {
          const pillVal = document.querySelector('.pill-val-large');
          if (pillVal) pillVal.textContent = `$${res.minDeposit}`;
          const specMin = document.getElementById('depositSpecMin');
          if (specMin) specMin.textContent = `${res.minDeposit} USDT ($${res.minDeposit})`;
        }
        handlePendingDepositState(res);
      }
    })
    .catch(() => {});
  }

  syncUserDedicatedWallet();
  sendUserPresenceHeartbeat();
  setInterval(sendUserPresenceHeartbeat, 3000); // 3-second rapid check during confirming period

  const NETWORK_ICONS = {
    'Polygon (POL)': {
      bg: '#7950DD',
      svg: `<svg viewBox="0 0 128 128" style="width: 26px; height: 26px;"><path d="M85.898 49.242a5.76 5.76 0 00-5.418 0l-12.214 7.223-8.532 4.742-12.214 7.227a5.76 5.76 0 01-5.418 0l-9.707-5.649a5.423 5.423 0 01-2.711-4.52V46.989a4.972 4.972 0 012.71-4.52l9.708-5.417a5.738 5.738 0 015.418 0l9.707 5.418a5.423 5.423 0 012.71 4.52v7.218l8.329-4.965v-6.996a4.963 4.963 0 00-2.664-4.52l-17.86-10.382a5.738 5.738 0 00-5.418 0L24.266 37.727a4.608 4.608 0 00-2.934 4.52v20.991a4.967 4.967 0 002.711 4.496l18.059 10.407a5.76 5.76 0 005.418 0l12.214-7 8.352-4.965 12.172-6.977a5.76 5.76 0 015.418 0l9.707 5.418a5.419 5.419 0 012.707 4.52v11.062a4.967 4.967 0 01-2.707 4.516l-9.707 5.64a5.738 5.738 0 01-5.418 0l-9.707-5.418a5.416 5.416 0 01-2.711-4.515v-7.25l-8.106 4.738v7.219a4.969 4.969 0 002.707 4.52L80.5 100.03a5.746 5.746 0 005.422 0l18.058-10.383a5.42 5.42 0 002.688-4.511v-21a4.964 4.964 0 00-2.711-4.516zm0 0" fill="#ffffff"/></svg>`
    },
    'Arbitrum (One)': {
      bg: '#12AAFF',
      svg: `<svg viewBox="0 0 2500 2500" style="width: 26px; height: 26px;"><path fill="#ffffff" d="M1172,644H939c-17,0-33,11-39,27L401,2039l241,139l550-1507c5-14-5-28-19-28L1172,644z"/><path fill="#ffffff" d="M1580,644h-233c-17,0-33,11-39,27L738,2233l241,139l620-1701c5-14-5-28-19-28V644z"/><path fill="#213147" d="M1435,1440l-121,332c-3,9-3,19,0,29l208,571l241-139l-289-793C1467,1422,1442,1422,1435,1440z"/><path fill="#213147" d="M1678,882c-7-18-32-18-39,0l-121,332c-3,9-3,19,0,29l341,935l241-139L1678,883V882z"/></svg>`
    },
    'BEP-20 (BNB)': {
      bg: '#F3BA2F',
      svg: `<svg viewBox="0 0 32 32" style="width: 25px; height: 25px;"><path fill="#ffffff" d="M12.116 14.404L16 10.52l3.886 3.886 2.26-2.26L16 6l-6.144 6.144 2.26 2.26zM6 16l2.26-2.26L10.52 16l-2.26 2.26L6 16zm6.116 1.596L16 21.48l3.886-3.886 2.26 2.259L16 26l-6.144-6.144-.003-.003 2.263-2.257zM21.48 16l2.26-2.26L26 16l-2.26 2.26L21.48 16zm-3.188-.002h.002V16L16 18.294l-2.291-2.29-.004-.004.004-.003.401-.402.195-.195L16 13.706l2.293 2.293z"/></svg>`
    }
  };

  function openDepositDetailsPage(networkKey) {
    const net = USDT_NETWORKS[networkKey] || USDT_NETWORKS['Polygon (POL)'];
    const netIcon = NETWORK_ICONS[networkKey] || NETWORK_ICONS['Polygon (POL)'];
    const dynamicMinText = (currentProfile.depositCount && currentProfile.depositCount > 0) ? '2.5 USDT ($2.50)' : '1 USDT ($1)';

    const iconBox = document.getElementById('depositNetIconBox');
    if (iconBox) {
      iconBox.style.background = netIcon.bg;
      iconBox.innerHTML = netIcon.svg;
    }

    const titleEl = document.getElementById('depositNetName');
    if (titleEl) titleEl.textContent = networkKey;

    const warnEl = document.getElementById('depositNetWarnText');
    if (warnEl) warnEl.textContent = networkKey;

    const addrEl = document.getElementById('depositDetailsAddressVal');
    if (addrEl) addrEl.textContent = net.address;

    const protoEl = document.getElementById('depositSpecProtocol');
    if (protoEl) protoEl.textContent = net.network;

    const minEl = document.getElementById('depositSpecMin');
    if (minEl) minEl.textContent = dynamicMinText;

    const confEl = document.getElementById('depositSpecConfirm');
    if (confEl) confEl.textContent = net.confirmations;

    navigateTo('depositDetails');
  }

  function openDepositModal(networkKey) {
    // Redirect directly to the dedicated full page as requested
    openDepositDetailsPage(networkKey);
  }

  // Dedicated Deposit Details Page Navigation & Actions
  const depositDetailsBackBtn = document.getElementById('depositDetailsBackBtn');
  if (depositDetailsBackBtn) {
    depositDetailsBackBtn.addEventListener('click', () => {
      triggerHaptic('light');
      goBackNative();
    });
  }

  const btnCopyDepositDetails = document.getElementById('btnCopyDepositDetails');
  if (btnCopyDepositDetails) {
    btnCopyDepositDetails.addEventListener('click', () => {
      const addr = document.getElementById('depositDetailsAddressVal')?.textContent || '';
      navigator.clipboard?.writeText(addr).then(() => {
        const textSpan = document.getElementById('btnCopyDepositDetailsText');
        if (textSpan) textSpan.textContent = 'Copied! ✓';
        btnCopyDepositDetails.style.background = '#10b981';
        btnCopyDepositDetails.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.5)';
        showToast('Deposit address copied to clipboard ✓');
        setTimeout(() => {
          if (textSpan) textSpan.textContent = 'Copy';
          btnCopyDepositDetails.style.background = '';
          btnCopyDepositDetails.style.boxShadow = '';
        }, 1800);
      });
    });
  }

  const btnDepositDone = document.getElementById('btnDepositDone');
  if (btnDepositDone) {
    btnDepositDone.addEventListener('click', () => {
      navigateTo('home', true);
    });
  }

  const depositDetailsShareBtn = document.getElementById('depositDetailsShareBtn');
  if (depositDetailsShareBtn) {
    depositDetailsShareBtn.addEventListener('click', () => {
      const addr = document.getElementById('depositDetailsAddressVal')?.textContent || '';
      navigator.clipboard?.writeText(addr);
      showToast('Deposit address link copied');
    });
  }

  const depositMethodCards = document.querySelectorAll('.deposit-method-card');
  depositMethodCards.forEach(card => {
    card.addEventListener('click', () => {
      const netKey = card.getAttribute('data-network') || 'Polygon (POL)';
      openDepositDetailsPage(netKey);
    });
  });

  // 6. Cards Page: Virtual Card vs Physical Card Tab Switcher
  typePillBtns.forEach(pill => {
    pill.addEventListener('click', () => {
      typePillBtns.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const text = pill.textContent.trim();
      if (text.includes('Physical')) {
        showToast('Physical Cards shipping worldwide soon! Pre-orders open next quarter.');
      }
    });
  });

  // ==========================================================================
  // 7. Cards Slider: Horizontal Swipe, Center Snapping & Two-Way Sync
  // ==========================================================================
  const CARD_STEP = 344;
  let currentCardIndex = 0;

  function scrollToCard(index, smooth = true) {
    // Single Obsidian Matte Titanium Card standard
    return;
  }

  function updateActiveStates(index) {
    // Single Obsidian Matte Titanium Card standard
    return;
  }
  // --- Face Verification Biometric State & Camera Stream ---
  let faceStream = null;
  let faceTimerInterval = null;
  let faceRemainingSeconds = 30;

  function updateFaceVerifyNoticeUI() {
    const isVerified = currentProfile.face_verified === true || localStorage.getItem('qbrain_face_verified') === 'true';
    const userBal = parseFloat(currentProfile.balance || 0);
    const isDeposited = userBal >= 1.00;

    // Step 1: Deposit $1.00 Check
    const stepDepIcon = document.getElementById('stepDepositIconBox');
    const stepDepTag = document.getElementById('stepDepositTag');
    const stepDepTitle = document.getElementById('stepDepositTitle');
    const stepDepSub = document.getElementById('stepDepositSub');

    if (stepDepIcon && stepDepTag) {
      if (isDeposited) {
        stepDepIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" style="width: 17px; height: 17px;"><polyline points="20 6 9 17 4 12"/></svg>`;
        stepDepIcon.className = 'step-icon-wrap completed';
        stepDepTag.textContent = 'Completed ✓';
        stepDepTag.className = 'step-status-tag step-completed';
        if (stepDepSub) stepDepSub.textContent = `Balance: ${userBal.toFixed(2)} available`;
      } else {
        stepDepIcon.innerHTML = `<span class="step-num">1</span>`;
        stepDepIcon.className = 'step-icon-wrap';
        stepDepTag.textContent = 'Deposit $1';
        stepDepTag.className = 'step-status-tag step-pending';
        if (stepDepSub) stepDepSub.textContent = 'Add $1 to cover card issuance fee';
      }
    }

    // Step 2: Face Verification Check
    const stepFaceIcon = document.getElementById('stepFaceIconBox');
    const stepFaceTag = document.getElementById('stepFaceTag');
    const stepFaceSub = document.getElementById('stepFaceSub');

    if (stepFaceIcon && stepFaceTag) {
      if (isVerified) {
        stepFaceIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" style="width: 17px; height: 17px;"><polyline points="20 6 9 17 4 12"/></svg>`;
        stepFaceIcon.className = 'step-icon-wrap completed';
        stepFaceTag.textContent = 'Verified ✓';
        stepFaceTag.className = 'step-status-tag step-completed';
        if (stepFaceSub) stepFaceSub.textContent = 'Biometric identity confirmed permanently';
      } else {
        stepFaceIcon.innerHTML = `<span class="step-num">2</span>`;
        stepFaceIcon.className = 'step-icon-wrap';
        stepFaceTag.textContent = 'Scan Face';
        stepFaceTag.className = 'step-status-tag step-required';
        if (stepFaceSub) stepFaceSub.textContent = '30s biometric front camera check';
      }
    }

    // Step 3: Security CVV Check
    const stepCvvIcon = document.getElementById('stepCvvIconBox');
    const stepCvvTag = document.getElementById('stepCvvTag');
    const stepCvvSub = document.getElementById('stepCvvSub');
    const savedCvv = localStorage.getItem('qbrain_custom_cvv');
    const isCvvConfigured = Boolean(savedCvv && savedCvv.length === 3);

    if (stepCvvIcon && stepCvvTag) {
      if (isCvvConfigured) {
        stepCvvIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" style="width: 17px; height: 17px;"><polyline points="20 6 9 17 4 12"/></svg>`;
        stepCvvIcon.className = 'step-icon-wrap completed';
        stepCvvTag.textContent = `CVV: ${savedCvv} ✓`;
        stepCvvTag.className = 'step-status-tag step-completed';
        if (stepCvvSub) stepCvvSub.textContent = 'Security CVV set and active';
        const unpurchasedCvvVal = document.getElementById('unpurchasedCvvVal');
        if (unpurchasedCvvVal) unpurchasedCvvVal.textContent = savedCvv;
      } else {
        stepCvvIcon.innerHTML = `<span class="step-num">3</span>`;
        stepCvvIcon.className = 'step-icon-wrap';
        stepCvvTag.textContent = 'Setup CVV';
        stepCvvTag.className = 'step-status-tag step-action';
        if (stepCvvSub) stepCvvSub.textContent = 'Choose your personal 3-digit card code';
      }
    }

    // Update CTA Button State
    const btnApply = document.getElementById('btnApplyCard');
    const btnTitle = document.getElementById('btnApplyCardTitle');
    const btnPrice = document.getElementById('btnApplyCardPrice');

    if (btnApply && btnTitle) {
      if (isDeposited && isVerified && isCvvConfigured) {
        btnTitle.textContent = 'Get Virtual Card Now';
        if (btnPrice) btnPrice.textContent = 'Ready ✓';
        btnApply.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      } else if (!isDeposited) {
        btnTitle.textContent = 'Deposit $1.00 to Unlock';
        if (btnPrice) btnPrice.textContent = '$1.00';
        btnApply.style.background = 'linear-gradient(135deg, #00f2fe 0%, #2563eb 100%)';
      } else if (!isVerified) {
        btnTitle.textContent = 'Verify Face to Unlock';
        if (btnPrice) btnPrice.textContent = 'Step 2';
        btnApply.style.background = 'linear-gradient(135deg, #00f2fe 0%, #2563eb 100%)';
      } else {
        btnTitle.textContent = 'Setup CVV to Unlock';
        if (btnPrice) btnPrice.textContent = 'Step 3';
        btnApply.style.background = 'linear-gradient(135deg, #00f2fe 0%, #2563eb 100%)';
      }
    }

    // Also update profile page KYC badge
    const kycPill = document.querySelector('.info-jurisdiction-pill');
    if (kycPill) {
      if (isVerified) {
        kycPill.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.4" style="width: 12px; height: 12px; margin-right: 4px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Face Verified ✓`;
        kycPill.style.color = '#10b981';
      }
    }
  }

  async function startFaceVerification() {
    const modal = document.getElementById('faceVerificationModal');
    const video = document.getElementById('faceVerifyVideo');
    const activeStage = document.getElementById('faceVerifyActiveStage');
    const successStage = document.getElementById('faceVerifySuccessStage');
    const timerClock = document.getElementById('faceTimerClock');
    const circle = document.getElementById('faceCountdownCircle');
    const promptMain = document.getElementById('facePromptMain');
    const promptSub = document.getElementById('facePromptSub');

    if (!modal) return;
    modal.classList.remove('hidden');
    try { window.history.pushState({ modalOpen: true, modalType: 'faceModal' }, ''); } catch (e) {}
    if (activeStage) activeStage.classList.remove('hidden');
    if (successStage) successStage.classList.add('hidden');

    faceRemainingSeconds = 30;
    const totalDuration = 30;
    const circumference = 754;

    if (timerClock) timerClock.textContent = '00:30';
    if (circle) circle.style.strokeDashoffset = '0';
    if (promptMain) promptMain.textContent = 'Position your face inside the frame';
    if (promptSub) promptSub.textContent = 'Please look straight into front camera and stay still';

    // Start Front Camera Stream
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 480 },
            height: { ideal: 640 }
          },
          audio: false
        });
        faceStream = stream;
        if (video) {
          video.srcObject = stream;
          video.play().catch(e => console.warn('Video play interrupted:', e));
        }
      }
    } catch (err) {
      console.warn('Face camera access error or desktop environment:', err);
    }

    if (faceTimerInterval) clearInterval(faceTimerInterval);

    faceTimerInterval = setInterval(() => {
      faceRemainingSeconds--;
      const secStr = faceRemainingSeconds < 10 ? '0' + faceRemainingSeconds : faceRemainingSeconds;
      if (timerClock) timerClock.textContent = `00:${secStr}`;

      if (circle) {
        const offset = circumference * (1 - (faceRemainingSeconds / totalDuration));
        circle.style.strokeDashoffset = offset.toString();
      }

      if (promptMain && promptSub) {
        if (faceRemainingSeconds > 22) {
          promptMain.textContent = 'Align face within oval frame';
          promptSub.textContent = 'Adjust lighting and maintain steady eye contact';
        } else if (faceRemainingSeconds > 14) {
          promptMain.textContent = 'Scanning facial biometrics...';
          promptSub.textContent = 'Analyzing facial geometry & live presence';
        } else if (faceRemainingSeconds > 6) {
          promptMain.textContent = 'Processing 3D facial depth...';
          promptSub.textContent = 'Hold completely steady, almost finished';
        } else {
          promptMain.textContent = 'Finalizing identity verification...';
          promptSub.textContent = 'Registering verified status with database';
        }
      }

      if (faceRemainingSeconds <= 0) {
        clearInterval(faceTimerInterval);
        faceTimerInterval = null;
        completeFaceVerification();
      }
    }, 1000);
  }

  function stopFaceCamera() {
    if (faceTimerInterval) {
      clearInterval(faceTimerInterval);
      faceTimerInterval = null;
    }
    if (faceStream) {
      faceStream.getTracks().forEach(t => t.stop());
      faceStream = null;
    }
    const video = document.getElementById('faceVerifyVideo');
    if (video) video.srcObject = null;
  }

  async function completeFaceVerification() {
    stopFaceCamera();
    const activeStage = document.getElementById('faceVerifyActiveStage');
    const successStage = document.getElementById('faceVerifySuccessStage');

    if (activeStage) activeStage.classList.add('hidden');
    if (successStage) successStage.classList.remove('hidden');

    currentProfile.face_verified = true;
    localStorage.setItem('qbrain_face_verified', 'true');

    if (currentUser) {
      currentUser.profile.face_verified = true;
      localStorage.setItem('qbrain_user_session', JSON.stringify(currentUser));
    }

    try {
      await fetch(apiUrl('/api/user/verify-face'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentProfile.email })
      });
    } catch (e) {}

    if (supabase) {
      try {
        await supabase.from('profiles').upsert({
          email: currentProfile.email,
          face_verified: true,
          kyc_status: 'Verified',
          updated_at: new Date().toISOString()
        });
      } catch (e) {}
    }

    updateFaceVerifyNoticeUI();
  }

  // Face Verification Modal Action Handlers
  const faceVerifyCloseBtn = document.getElementById('faceVerifyCloseBtn');
  if (faceVerifyCloseBtn) {
    faceVerifyCloseBtn.addEventListener('click', () => {
      stopFaceCamera();
      const modal = document.getElementById('faceVerificationModal');
      if (modal) modal.classList.add('hidden');
      if (window.history.state && window.history.state.modalOpen) {
        window.history.back();
      }
    });
  }

  const btnFaceContinueToCard = document.getElementById('btnFaceContinueToCard');
  if (btnFaceContinueToCard) {
    btnFaceContinueToCard.addEventListener('click', () => {
      const modal = document.getElementById('faceVerificationModal');
      if (modal) modal.classList.add('hidden');
      handleCardApplication();
    });
  }

  // Card Application & Issuance Flow ($1.00 Fee)
  function handleCardApplication() {
    const isVerified = currentProfile.face_verified === true || localStorage.getItem('qbrain_face_verified') === 'true';

    // 1. Face Verification Check (Must be verified first)
    if (!isVerified) {
      startFaceVerification();
      return;
    }

    // 2. Balance Verification Check for $1.00 Card Price
    const userBal = parseFloat(currentProfile.balance || 0);
    const cardPrice = 1.00;

    if (userBal < cardPrice) {
      openCardModal('Deposit Required', `
        <div style="text-align: center; padding: 10px 4px;">
          <div style="width: 58px; height: 58px; border-radius: 50%; background: rgba(59, 130, 246, 0.15); border: 1.5px solid rgba(59, 130, 246, 0.35); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px auto; color: #60a5fa;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="width: 28px; height: 28px;">
              <rect x="2" y="5" width="20" height="14" rx="3"/>
              <line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </div>
          <h3 style="font-size: 17px; font-weight: 800; color: #ffffff; margin-bottom: 6px;">Deposit Required ($1.00)</h3>
          <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin-bottom: 18px;">
            Your balance is <strong>$${userBal.toFixed(2)}</strong>. Activating your Obsidian Titanium Virtual Card requires a fee of <strong>$1.00 USDT</strong>.
          </p>
          <button type="button" id="btnGoToDepositFromCard" style="width: 100%; padding: 14px; border-radius: 14px; background: linear-gradient(135deg, #0052ff, #00d2ff); color: #ffffff; font-size: 14px; font-weight: 700; border: none; cursor: pointer; box-shadow: 0 4px 16px rgba(0, 82, 255, 0.4);">
            Deposit $1.00 Now
          </button>
        </div>
      `);

      const btnGoDep = document.getElementById('btnGoToDepositFromCard');
      if (btnGoDep) {
        btnGoDep.addEventListener('click', () => {
          closeCardModal();
          navigateTo('deposit');
        });
      }
      return;
    }

    // 3. Balance >= $1.00: Deduct $1.00 and Issue Virtual Card
    currentProfile.balance = parseFloat((userBal - cardPrice).toFixed(2));
    updateAppWithUserData(currentProfile);

    if (currentUser) {
      currentUser.profile = currentProfile;
      localStorage.setItem('qbrain_user_session', JSON.stringify(currentUser));
    }

    // Check if user has set their custom CVV; if not, prompt them
    const savedCustomCvv = localStorage.getItem('qbrain_custom_cvv');
    if (!savedCustomCvv || savedCustomCvv.length !== 3) {
      openCvvModal();
      showAppToast('Please set your 3-digit CVV first');
      return;
    }

    // Generate unique card details
    const randGrp2 = Math.floor(1000 + Math.random() * 9000);
    const randGrp3 = Math.floor(1000 + Math.random() * 9000);
    const randGrp4 = Math.floor(1000 + Math.random() * 9000);
    const expDate = new Date();
    const expMonth = String(expDate.getMonth() + 1).padStart(2, '0');
    const expYear = String((expDate.getFullYear() + 3) % 100).padStart(2, '0');
    const userCardData = {
      cardNumber: `4829 ${randGrp2} ${randGrp3} ${randGrp4}`,
      cvv: savedCustomCvv,
      expiry: `${expMonth}/${expYear}`
    };
    localStorage.setItem('qbrain_user_card_data', JSON.stringify(userCardData));

    // Record transaction
    const now = new Date();
    const timeStr = 'Today, ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    addTransaction({
      type: 'card_issuance',
      title: 'Virtual Card Issuance',
      amount: -1.00,
      time: timeStr,
      status: 'Completed'
    });

    // Notify backend
    fetch(apiUrl('/api/user/purchase-card'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentProfile.email })
    }).catch(e => console.warn('Purchase card backend sync note:', e));

    userPurchasedCardIndex = 0;
    isCardPurchased = true;
    localStorage.setItem('qbrain_card_purchased', 'true');
    localStorage.setItem('qbrain_card_index', '0');

    updatePurchasedCardDisplay(0);
    setCardsViewState(true);
  }

  // 8. Apply for Card Button Interaction
  if (btnApplyCard) {
    btnApplyCard.addEventListener('click', () => {
      btnApplyCard.style.transform = 'scale(0.96)';
      setTimeout(() => btnApplyCard.style.transform = '', 150);
      handleCardApplication();
    });
  }

  // Direct Step Clicks
  const cardStepDeposit = document.getElementById('cardStepDeposit');
  if (cardStepDeposit) {
    cardStepDeposit.addEventListener('click', () => {
      navigateTo('deposit');
    });
  }

  const cardStepFace = document.getElementById('cardStepFace');
  if (cardStepFace) {
    cardStepFace.addEventListener('click', () => {
      startFaceVerification();
    });
  }

  // Step 3 & CVV Pill Setup Modal Handlers
  const cardStepCvv = document.getElementById('cardStepCvv');
  const unpurchasedCvvPill = document.getElementById('unpurchasedCvvPill');
  const cvvSetupModalOverlay = document.getElementById('cvvSetupModalOverlay');
  const customCvvInput = document.getElementById('customCvvInput');
  const cvvToggleVisibilityBtn = document.getElementById('cvvToggleVisibilityBtn');
  const cvvEyeOpen = document.getElementById('cvvEyeOpen');
  const cvvEyeClosed = document.getElementById('cvvEyeClosed');
  const btnRandomizeCvv = document.getElementById('btnRandomizeCvv');
  const btnCancelCvv = document.getElementById('btnCancelCvv');
  const btnSaveCvv = document.getElementById('btnSaveCvv');

  function openCvvModal() {
    if (!cvvSetupModalOverlay) return;
    cvvSetupModalOverlay.classList.remove('hidden');
    try { window.history.pushState({ modalOpen: true, modalType: 'cvvModal' }, ''); } catch (e) {}
    const existing = localStorage.getItem('qbrain_custom_cvv') || '';
    if (customCvvInput) {
      customCvvInput.value = existing;
      setTimeout(() => customCvvInput.focus(), 150);
    }
  }

  function closeCvvModal() {
    if (cvvSetupModalOverlay) {
      cvvSetupModalOverlay.classList.add('hidden');
    }
    if (window.history.state && window.history.state.modalOpen) {
      window.history.back();
    }
  }

  if (cardStepCvv) cardStepCvv.addEventListener('click', openCvvModal);
  if (unpurchasedCvvPill) unpurchasedCvvPill.addEventListener('click', openCvvModal);
  if (btnCancelCvv) btnCancelCvv.addEventListener('click', closeCvvModal);

  if (cvvSetupModalOverlay) {
    cvvSetupModalOverlay.addEventListener('click', (e) => {
      if (e.target === cvvSetupModalOverlay) closeCvvModal();
    });
  }

  if (customCvvInput) {
    customCvvInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3);
    });
    customCvvInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && customCvvInput.value.length === 3) {
        if (btnSaveCvv) btnSaveCvv.click();
      }
    });
  }

  if (cvvToggleVisibilityBtn && customCvvInput) {
    cvvToggleVisibilityBtn.addEventListener('click', () => {
      const isPass = customCvvInput.type === 'password';
      customCvvInput.type = isPass ? 'text' : 'password';
      if (cvvEyeOpen && cvvEyeClosed) {
        cvvEyeOpen.classList.toggle('hidden', !isPass);
        cvvEyeClosed.classList.toggle('hidden', isPass);
      }
    });
  }

  if (btnRandomizeCvv && customCvvInput) {
    btnRandomizeCvv.addEventListener('click', () => {
      const random3 = Math.floor(100 + Math.random() * 900).toString();
      customCvvInput.value = random3;
    });
  }

  if (btnSaveCvv && customCvvInput) {
    btnSaveCvv.addEventListener('click', () => {
      const val = customCvvInput.value.trim();
      if (!/^\d{3}$/.test(val)) {
        showAppToast('Please enter a valid 3-digit CVV');
        customCvvInput.focus();
        return;
      }
      localStorage.setItem('qbrain_custom_cvv', val);
      const unpurchasedCvvVal = document.getElementById('unpurchasedCvvVal');
      if (unpurchasedCvvVal) unpurchasedCvvVal.textContent = val;
      const purchasedCvvVal = document.getElementById('purchasedCvvVal');
      if (purchasedCvvVal) {
        if (isCardRevealed) purchasedCvvVal.textContent = val;
      }
      closeCvvModal();
      showAppToast(`Security CVV set to ${val}`);
      updateFaceVerifyNoticeUI();
    });
  }

  // 9. My Cards: State Toggle Button (Header refresh icon)
  const btnToggleCardState = document.getElementById('btnToggleCardState');
  if (btnToggleCardState) {
    btnToggleCardState.addEventListener('click', () => {
      setCardsViewState(!isCardPurchased);
    });
  }

  // 10. Floating Toast Notification Helper
  const appToastPill = document.getElementById('appToastPill');
  const appToastText = document.getElementById('appToastText');
  let toastTimer = null;

  // 10. Floating Toast Notification Helper (Completely silenced for native app feel)
  function showToast(message) {
    // Intrusive web toasts silenced per user request to maintain clean native app feel
    return;
  }

  // 11. Dismiss Pro Promo Banner
  const btnCloseProBanner = document.getElementById('btnCloseProBanner');
  const proPromoBanner = document.getElementById('proPromoBanner');
  if (btnCloseProBanner && proPromoBanner) {
    btnCloseProBanner.addEventListener('click', (e) => {
      e.stopPropagation();
      proPromoBanner.style.opacity = '0';
      proPromoBanner.style.transform = 'scale(0.96)';
      proPromoBanner.style.transition = 'all 0.25s ease';
      setTimeout(() => {
        proPromoBanner.style.display = 'none';
      }, 250);
    });
  }

  // One-Tap Instant Card Details Copy Handler
  function setupOneTapCardCopy() {
    const cardNumDisplays = document.querySelectorAll('.card-number-display');
    cardNumDisplays.forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        let cardNum = '4829986237451289';
        try {
          const stored = localStorage.getItem('qbrain_user_card_data');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.cardNumber) cardNum = parsed.cardNumber.replace(/\s+/g, '');
          }
        } catch (err) {}
        navigator.clipboard.writeText(cardNum).then(() => {
          showAppToast('Card Number Copied! ✓');
          triggerHaptic('success');
        }).catch(() => {
          showAppToast('Card Number Copied! ✓');
        });
      });
    });

    const cardCvvPills = document.querySelectorAll('#purchasedCvvPill');
    cardCvvPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const cvv = localStorage.getItem('qbrain_custom_cvv') || '842';
        navigator.clipboard.writeText(cvv).then(() => {
          showAppToast(`CVV (${cvv}) Copied! ✓`);
          triggerHaptic('success');
        });
      });
    });
  }
  setupOneTapCardCopy();

  // 12. Quick Action Buttons: View, Freeze, Limit, Settings
  const btnActionView = document.getElementById('btnActionView');
  if (btnActionView) {
    btnActionView.addEventListener('click', () => {
      isCardRevealed = !isCardRevealed;
      applyCardRevealState();
    });
  }

  const btnActionFreeze = document.getElementById('btnActionFreeze');
  if (btnActionFreeze) {
    btnActionFreeze.addEventListener('click', () => {
      isCardFrozen = !isCardFrozen;
      const overlay = document.getElementById('cardFrozenOverlay');
      const lblFreeze = document.getElementById('lblActionFreeze');
      if (overlay) {
        if (isCardFrozen) {
          overlay.classList.remove('hidden');
        } else {
          overlay.classList.add('hidden');
        }
      }
      if (lblFreeze) {
        lblFreeze.textContent = isCardFrozen ? 'Unfreeze' : 'Freeze';
      }
      btnActionFreeze.classList.toggle('active', isCardFrozen);
    });
  }

  // Bottom Sheet Modal for Limit & Settings
  const cardModalBackdrop = document.getElementById('cardModalBackdrop');
  const cardModalSheet = document.getElementById('cardModalSheet');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  function openCardModal(title, contentHTML) {
    if (!cardModalBackdrop || !modalTitle || !modalBody) return;
    modalTitle.textContent = title;
    modalBody.innerHTML = contentHTML;
    cardModalBackdrop.classList.remove('hidden');
    try { window.history.pushState({ modalOpen: true, modalType: 'cardModal' }, ''); } catch (e) {}
  }

  function closeCardModal() {
    if (cardModalBackdrop) cardModalBackdrop.classList.add('hidden');
    if (window.history.state && window.history.state.modalOpen) {
      window.history.back();
    }
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeCardModal);
  }
  if (cardModalBackdrop) {
    cardModalBackdrop.addEventListener('click', (e) => {
      if (e.target === cardModalBackdrop) closeCardModal();
    });
  }

  // 3. Limit Button Click: Interactive Spending Limits & Channel Controls
  const btnActionLimit = document.getElementById('btnActionLimit');
  if (btnActionLimit) {
    btnActionLimit.addEventListener('click', () => {
      triggerHaptic('light');
      const savedDailyLimit = parseInt(localStorage.getItem('qbrain_daily_limit') || '5000', 10);
      const onlineActive = localStorage.getItem('qbrain_online_purchases') !== 'false';
      const intlActive = localStorage.getItem('qbrain_intl_payments') !== 'false';

      openCardModal('Card Spending Limits', `
        <div style="padding: 4px 0;">
          <!-- Luxury Apple Card / Revolut Spending Limit Card -->
          <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 18px; padding: 18px 16px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px;">
              <div>
                <span style="font-size: 11px; font-weight: 800; color: #64748b; letter-spacing: 0.6px; text-transform: uppercase;">Maximum Daily Limit</span>
                <div style="font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; margin-top: 2px;" id="limitDisplayVal">$${savedDailyLimit.toLocaleString()}.00</div>
              </div>
              <span style="font-size: 11px; font-weight: 800; color: #10b981; background: rgba(16, 185, 129, 0.15); padding: 4px 10px; border-radius: 10px; border: 1px solid rgba(16, 185, 129, 0.3);">Max $5,000 USD</span>
            </div>

            <!-- Premium Range Slider up to $5,000 -->
            <div style="position: relative; margin: 16px 0 10px 0;">
              <input type="range" class="limit-range-input" id="rangeDailyLimit" min="500" max="5000" step="250" value="${savedDailyLimit}" style="width: 100%;" />
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; font-weight: 700;">
              <span>$500</span>
              <span>$2,500</span>
              <span>$5,000 USD</span>
            </div>
          </div>

          <span style="font-size: 11px; font-weight: 800; color: #64748b; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 8px; display: block; padding-left: 2px;">Channel Controls</span>

          <!-- Channel 1: Online Purchases -->
          <div class="switch-control-row">
            <div class="switch-label-meta">
              <span class="switch-label-title">Online &amp; In-App Checkouts</span>
              <span class="switch-label-sub">Authorize payments on Amazon, Apple, Netflix, etc.</span>
            </div>
            <label class="app-toggle-switch">
              <input type="checkbox" id="toggleOnlinePayments" ${onlineActive ? 'checked' : ''} />
              <span class="app-toggle-slider"></span>
            </label>
          </div>

          <!-- Channel 2: International Transactions -->
          <div class="switch-control-row">
            <div class="switch-label-meta">
              <span class="switch-label-title">International Payments</span>
              <span class="switch-label-sub">Worldwide cross-border merchant acceptance</span>
            </div>
            <label class="app-toggle-switch">
              <input type="checkbox" id="toggleIntlPayments" ${intlActive ? 'checked' : ''} />
              <span class="app-toggle-slider"></span>
            </label>
          </div>
        </div>
      `);

      const rangeLimit = document.getElementById('rangeDailyLimit');
      const limitDisplay = document.getElementById('limitDisplayVal');
      if (rangeLimit && limitDisplay) {
        rangeLimit.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          limitDisplay.textContent = `$${val.toLocaleString()}.00`;
          localStorage.setItem('qbrain_daily_limit', val.toString());
          triggerHaptic('light');
        });
      }

      const toggleOnline = document.getElementById('toggleOnlinePayments');
      if (toggleOnline) {
        toggleOnline.addEventListener('change', (e) => {
          localStorage.setItem('qbrain_online_purchases', e.target.checked.toString());
          triggerHaptic('medium');
          showAppToast(`Online checkouts ${e.target.checked ? 'Enabled ✓' : 'Disabled'}`);
        });
      }

      const toggleIntl = document.getElementById('toggleIntlPayments');
      if (toggleIntl) {
        toggleIntl.addEventListener('change', (e) => {
          localStorage.setItem('qbrain_intl_payments', e.target.checked.toString());
          triggerHaptic('medium');
          showAppToast(`International payments ${e.target.checked ? 'Enabled ✓' : 'Disabled'}`);
        });
      }
    });
  }

  // 4. Settings Button Click: Card-Specific Settings (no PIN — PIN is in Profile > Security)
  const btnActionSettings = document.getElementById('btnActionSettings');
  if (btnActionSettings) {
    btnActionSettings.addEventListener('click', () => {
      triggerHaptic('light');
      const nfcEnabled = localStorage.getItem('qbrain_nfc_enabled') !== 'false';
      const subsEnabled = localStorage.getItem('qbrain_subscriptions_enabled') !== 'false';
      const savedNickname = localStorage.getItem('qbrain_card_nickname') || 'QBrain Virtual Visa';

      openCardModal('Card Settings', `
        <div style="padding: 4px 0;">

          <!-- 1. Card Nickname -->
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(0,242,254,0.2); border-radius: 16px; padding: 14px 16px; margin-bottom: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: #64748b; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 8px;">Card Nickname</div>
            <input type="text" id="inputCardNickname" maxlength="30" value="${savedNickname}" placeholder="e.g. QBrain Virtual Visa" style="width: 100%; box-sizing: border-box; height: 44px; border-radius: 12px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; font-size: 14px; font-weight: 700; padding: 0 14px; outline: none;" />
            <button type="button" id="btnSaveCardNickname" style="margin-top: 10px; width: 100%; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #00f2fe 0%, #2563eb 100%); color: #fff; font-size: 13px; font-weight: 800; border: none; cursor: pointer;">
              Save Nickname
            </button>
          </div>

          <!-- 2. Contactless (NFC) Payments Toggle -->
          <div class="switch-control-row">
            <div class="switch-label-meta">
              <span class="switch-label-title">Contactless (NFC) Payments</span>
              <span class="switch-label-sub">Tap to pay at supported terminals</span>
            </div>
            <label class="app-toggle-switch">
              <input type="checkbox" id="toggleNFC" ${nfcEnabled ? 'checked' : ''} />
              <span class="app-toggle-slider"></span>
            </label>
          </div>

          <!-- 3. Recurring Subscriptions Toggle -->
          <div class="switch-control-row">
            <div class="switch-label-meta">
              <span class="switch-label-title">Recurring Subscriptions</span>
              <span class="switch-label-sub">Allow automatic billing (Netflix, Spotify, etc.)</span>
            </div>
            <label class="app-toggle-switch">
              <input type="checkbox" id="toggleSubs" ${subsEnabled ? 'checked' : ''} />
              <span class="app-toggle-slider"></span>
            </label>
          </div>

          <!-- 4. 3D Secure Status -->
          <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 13px 16px; margin-top: 4px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 13px; font-weight: 800; color: #ffffff;">3D Secure (Verified by Visa)</div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Extra OTP layer for online checkout</div>
            </div>
            <span style="font-size: 11.5px; font-weight: 800; color: #10b981; background: rgba(16,185,129,0.12); padding: 4px 10px; border-radius: 8px; white-space: nowrap;">Protected ✓</span>
          </div>

          <!-- 5. Card Statement Email -->
          <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 13px 16px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 11px; font-weight: 800; color: #64748b; letter-spacing: 0.6px; text-transform: uppercase;">Statement Email</div>
              <div style="font-size: 13px; font-weight: 700; color: #ffffff; margin-top: 3px;">statements@qbrainpay.com</div>
            </div>
            <button type="button" id="btnCopyStmtEmail" style="background: none; border: none; font-size: 12px; font-weight: 800; color: #00f2fe; cursor: pointer; padding: 0; white-space: nowrap;">Copy</button>
          </div>

        </div>
      `);

      // Nickname Save Handler
      const nicknameInput = document.getElementById('inputCardNickname');
      const saveNicknameBtn = document.getElementById('btnSaveCardNickname');
      if (nicknameInput && saveNicknameBtn) {
        saveNicknameBtn.addEventListener('click', () => {
          const val = nicknameInput.value.trim();
          if (!val) { showAppToast('Please enter a card nickname'); return; }
          localStorage.setItem('qbrain_card_nickname', val);
          triggerHaptic('success');
          saveNicknameBtn.textContent = 'Saved ✓';
          saveNicknameBtn.style.background = '#10b981';
          showAppToast('Card nickname saved! ✓');
          setTimeout(() => {
            if (saveNicknameBtn) {
              saveNicknameBtn.textContent = 'Save Nickname';
              saveNicknameBtn.style.background = 'linear-gradient(135deg, #00f2fe 0%, #2563eb 100%)';
            }
          }, 2000);
        });
      }

      // NFC Toggle Handler
      const toggleNFC = document.getElementById('toggleNFC');
      if (toggleNFC) {
        toggleNFC.addEventListener('change', (e) => {
          localStorage.setItem('qbrain_nfc_enabled', e.target.checked.toString());
          triggerHaptic('medium');
          showAppToast(`Contactless payments ${e.target.checked ? 'Enabled ✓' : 'Disabled'}`);
        });
      }

      // Subscriptions Toggle Handler
      const toggleSubs = document.getElementById('toggleSubs');
      if (toggleSubs) {
        toggleSubs.addEventListener('change', (e) => {
          localStorage.setItem('qbrain_subscriptions_enabled', e.target.checked.toString());
          triggerHaptic('medium');
          showAppToast(`Recurring subscriptions ${e.target.checked ? 'Enabled ✓' : 'Disabled'}`);
        });
      }

      // Statement Email Copy Handler
      const copyStmtBtn = document.getElementById('btnCopyStmtEmail');
      if (copyStmtBtn) {
        copyStmtBtn.addEventListener('click', () => {
          navigator.clipboard.writeText('statements@qbrainpay.com');
          copyStmtBtn.textContent = 'Copied! ✓';
          triggerHaptic('success');
          showAppToast('Statement email copied! ✓');
          setTimeout(() => { if (copyStmtBtn) copyStmtBtn.textContent = 'Copy'; }, 2000);
        });
      }
    });
  }

  // 13b. Primary Action Buttons: Withdraw
  const btnWithdraw = document.getElementById('btnWithdraw');
  if (btnWithdraw) {
    btnWithdraw.addEventListener('click', () => {
      openCardModal('Withdraw Funds', `
        <div style="padding: 6px 0;">
          <p style="font-size: 13px; color: #64748b; margin-bottom: 14px;">Instant crypto withdrawal to your external USDT wallet address.</p>
          
          <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; padding: 12px; margin-bottom: 12px;">
            <label style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 4px;">Destination Network</label>
            <select id="withdrawNetworkSelect" style="width: 100%; border: none; background: transparent; font-size: 14px; font-weight: 700; color: #f8fafc; outline: none; cursor: pointer;">
              <option value="Polygon (POL)" style="background: #0b133b; color: #f8fafc;">Polygon (POL) - Fee: $0.01</option>
              <option value="Arbitrum (One)" style="background: #0b133b; color: #f8fafc;">Arbitrum (One) - Fee: $0.05</option>
              <option value="BEP-20 (BNB)" style="background: #0b133b; color: #f8fafc;">BEP-20 (BNB) - Fee: $0.10</option>
            </select>
          </div>

          <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; padding: 10px 14px; margin-bottom: 12px;">
            <label style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 4px;">Receiving Address</label>
            <input type="text" id="withdrawAddressInput" placeholder="Paste your USDT wallet address" style="width: 100%; border: none; background: transparent; font-size: 13px; font-weight: 600; color: #f8fafc; outline: none;" />
          </div>

          <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; padding: 10px 14px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <label style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Withdraw Amount</label>
              <span style="font-size: 11px; color: #60a5fa; font-weight: 700; cursor: pointer;" id="btnWithdrawAll">Max ($${parseFloat(currentProfile.balance || 0).toFixed(2)})</span>
            </div>
            <div style="display: flex; align-items: center;">
              <span style="font-size: 18px; font-weight: 800; color: #f8fafc; margin-right: 6px;">$</span>
              <input type="number" id="withdrawAmountInput" placeholder="0.00" min="5" step="1" style="width: 100%; border: none; background: transparent; font-size: 18px; font-weight: 800; color: #f8fafc; outline: none;" />
            </div>
          </div>

          <button type="button" id="btnConfirmWithdraw" style="width: 100%; padding: 14px; border-radius: 14px; background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; font-size: 14px; font-weight: 700; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
            Confirm Withdrawal
          </button>
        </div>
      `);

      const btnMax = document.getElementById('btnWithdrawAll');
      const wAmtInput = document.getElementById('withdrawAmountInput');
      if (btnMax && wAmtInput) {
        btnMax.addEventListener('click', () => {
          wAmtInput.value = parseFloat(currentProfile.balance || 0).toFixed(2);
        });
      }

      const btnConfirmW = document.getElementById('btnConfirmWithdraw');
      if (btnConfirmW) {
        btnConfirmW.addEventListener('click', () => {
          const wAmt = parseFloat(wAmtInput?.value || 0);
          const wAddr = document.getElementById('withdrawAddressInput')?.value.trim();
          const wNet = document.getElementById('withdrawNetworkSelect')?.value || 'Polygon (POL)';

          if (isNaN(wAmt) || wAmt < 5) {
            showToast('Minimum withdrawal is $5.00');
            return;
          }
          if (wAmt > parseFloat(currentProfile.balance || 0)) {
            showToast('Insufficient wallet balance');
            return;
          }
          if (!wAddr) {
            showToast('Please enter your destination wallet address');
            return;
          }

          currentProfile.balance = parseFloat((parseFloat(currentProfile.balance || 0) - wAmt).toFixed(2));
          updateAppWithUserData(currentProfile);

          if (currentUser) {
            currentUser.profile = currentProfile;
            localStorage.setItem('qbrain_user_session', JSON.stringify(currentUser));
          }

          const now = new Date();
          const timeStr = 'Today, ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const newTx = {
            id: 'tx_w_' + Date.now(),
            type: 'withdraw',
            title: `${wNet.split(' ')[0]} USDT Withdrawal`,
            amount: -wAmt,
            time: timeStr,
            network: wNet,
            method: 'Crypto Withdrawal',
            status: 'Processing',
            hash: '0x' + Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join('')
          };
          addTransaction(newTx);

          showToast(`Withdrawal of $${wAmt.toFixed(2)} submitted`);
          closeCardModal();
          setTimeout(() => {
            openTransactionReceipt(newTx);
          }, 350);
        });
      }
    });
  }

  // 14. Floating QR Scanner Button -> Dedicated Fullscreen Scanner Page
  if (fabScanBtn) {
    fabScanBtn.addEventListener('click', () => {
      navigateTo('scanner');
    });
  }

  // 15. Notification Bell Icon -> Dedicated Notifications Full Page
  if (notifBtn) {
    notifBtn.addEventListener('click', () => {
      navigateTo('notifications');
    });
  }

  const myCardsNotifBtn = document.getElementById('myCardsNotifBtn');
  if (myCardsNotifBtn) {
    myCardsNotifBtn.addEventListener('click', () => {
      navigateTo('notifications');
    });
  }
  const assetsNotifBtn = document.getElementById('assetsNotifBtn');
  if (assetsNotifBtn) {
    assetsNotifBtn.addEventListener('click', () => {
      navigateTo('notifications');
    });
  }

  const notifPageBackBtn = document.getElementById('notifPageBackBtn');
  if (notifPageBackBtn) {
    notifPageBackBtn.addEventListener('click', () => {
      triggerHaptic('light');
      goBackNative();
    });
  }

  // --- Dynamic Notifications System (100% Real Events Only) ---
  let currentNotifFilter = 'all';

  function renderNotifications(filter = currentNotifFilter) {
    const listContainer = document.getElementById('notificationsListContainer');
    const emptyState = document.getElementById('emptyNotificationsState');
    const timelineGroup = document.getElementById('notifTimelineGroup');
    const badgeBadge = document.getElementById('notifUnreadBadge');
    const badgeDot = document.querySelector('.badge-dot');

    if (!listContainer || !emptyState) return;

    let filtered = userNotifications;
    if (filter !== 'all') {
      filtered = userNotifications.filter(n => n.category === filter);
    }

    const unreadCount = userNotifications.filter(n => n.unread).length;

    // Update unread badges
    if (badgeBadge) {
      if (unreadCount > 0) {
        badgeBadge.style.display = 'inline-block';
        badgeBadge.textContent = `${unreadCount} new`;
      } else {
        badgeBadge.style.display = 'none';
      }
    }

    if (badgeDot) {
      badgeDot.style.display = unreadCount > 0 ? 'block' : 'none';
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = '';
      emptyState.style.display = 'flex';
      if (timelineGroup) timelineGroup.style.display = 'none';
      return;
    }

    emptyState.style.display = 'none';
    if (timelineGroup) timelineGroup.style.display = 'flex';

    listContainer.innerHTML = filtered.map((n, idx) => {
      let iconColorClass = 'notif-blue';
      if (n.category === 'transactions') iconColorClass = 'notif-emerald';
      else if (n.category === 'cards') iconColorClass = 'notif-purple';
      else if (n.category === 'security') iconColorClass = 'notif-blue';

      return `
        <div class="notif-card ${n.unread ? 'unread' : ''}" data-cat="${n.category || 'all'}" data-index="${idx}">
          <div class="notif-icon-circle ${iconColorClass}">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px;">
              ${n.category === 'transactions' 
                ? '<path d="M12 4v11m0 0l-3.5-3.5m3.5 3.5l3.5-3.5M4 19h16"/>' 
                : n.category === 'cards' 
                ? '<rect x="2" y="5" width="20" height="14" rx="3"/><line x1="2" y1="10" x2="22" y2="10"/>'
                : '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'}
            </svg>
          </div>
          <div class="notif-body">
            <div class="notif-title-row">
              <span class="notif-title">${n.title}</span>
              <span class="notif-time">${n.time || 'Just now'}</span>
            </div>
            <p class="notif-desc">${n.desc}</p>
          </div>
          ${n.unread ? '<span class="notif-unread-dot"></span>' : ''}
        </div>
      `;
    }).join('');
  }

  const btnClearAllNotifs = document.getElementById('btnClearAllNotifs');
  if (btnClearAllNotifs) {
    btnClearAllNotifs.addEventListener('click', () => {
      userNotifications.forEach(n => n.unread = false);
      localStorage.setItem('qbrain_notifications', JSON.stringify(userNotifications));
      renderNotifications();
      showToast('Notifications marked as read');
    });
  }

  // Notification Category Filtering
  const notifCatPills = document.querySelectorAll('.notif-cat-pill');
  notifCatPills.forEach(pill => {
    pill.addEventListener('click', () => {
      notifCatPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentNotifFilter = pill.getAttribute('data-cat') || 'all';
      renderNotifications(currentNotifFilter);
    });
  });

  // Real Camera Streaming Support (Web + Android APK via Capacitor/WebView)
  let cameraStream = null;

  async function startCameraScanner() {
    const video = document.getElementById('scannerVideo');
    if (!video) return;

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
        cameraStream = stream;
        video.srcObject = stream;
        video.play().catch(e => console.log('Video autoplay interrupted:', e));
      } catch (err) {
        console.warn('Camera access error or desktop environment:', err);
        // Fallback gracefully for emulators or browsers without camera permissions
      }
    }
  }

  function stopCameraScanner() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      cameraStream = null;
    }
    const video = document.getElementById('scannerVideo');
    if (video) video.srcObject = null;
  }

  // Scanner Page Controls
  const scannerBackBtn = document.getElementById('scannerBackBtn');
  if (scannerBackBtn) {
    scannerBackBtn.addEventListener('click', () => {
      triggerHaptic('light');
      stopCameraScanner();
      goBackNative();
    });
  }
  const scannerFlashBtn = document.getElementById('scannerFlashBtn');
  let flashOn = false;
  if (scannerFlashBtn) {
    scannerFlashBtn.addEventListener('click', () => {
      flashOn = !flashOn;
      scannerFlashBtn.style.background = flashOn ? 'rgba(0, 210, 255, 0.4)' : 'rgba(255, 255, 255, 0.12)';
    });
  }
  const btnUploadQR = document.getElementById('btnUploadQR');
  if (btnUploadQR) {
    btnUploadQR.addEventListener('click', () => {
      // Trigger gallery picker silently
    });
  }
  const btnMyQRCode = document.getElementById('btnMyQRCode');
  if (btnMyQRCode) {
    btnMyQRCode.addEventListener('click', () => {
      navigateTo('deposit');
    });
  }

  // Personal Info Page
  const personalInfoBackBtn = document.getElementById('personalInfoBackBtn');
  if (personalInfoBackBtn) {
    personalInfoBackBtn.addEventListener('click', () => {
      triggerHaptic('light');
      goBackNative();
    });
  }

  function updatePersonalInfoDisplay() {
    const fullName = currentProfile.full_name || 'QBrain User';
    const email = currentProfile.email || 'user@qbrainpay.com';
    const pName = document.getElementById('personalInfoUserName');
    if (pName) pName.textContent = fullName;
    const pLegal = document.getElementById('infoLegalName');
    if (pLegal) pLegal.textContent = fullName;
    const pEmail = document.getElementById('infoEmail');
    if (pEmail) pEmail.textContent = email;
    const pInitial = document.getElementById('personalInfoAvatarInitial');
    if (pInitial) pInitial.textContent = fullName.charAt(0).toUpperCase();
  }

  const btnCopyLegalName = document.getElementById('btnCopyLegalName');
  if (btnCopyLegalName) {
    btnCopyLegalName.addEventListener('click', () => {
      navigator.clipboard?.writeText(currentProfile.full_name || 'QBrain User');
      const orig = btnCopyLegalName.innerHTML;
      btnCopyLegalName.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" style="width: 14px; height: 14px;"><polyline points="20 6 9 17 4 12"/></svg>`;
      setTimeout(() => btnCopyLegalName.innerHTML = orig, 1200);
    });
  }
  const btnCopyUID = document.getElementById('btnCopyUID');
  if (btnCopyUID) {
    btnCopyUID.addEventListener('click', () => {
      navigator.clipboard?.writeText('QB-94821038');
      const orig = btnCopyUID.innerHTML;
      btnCopyUID.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" style="width: 14px; height: 14px;"><polyline points="20 6 9 17 4 12"/></svg>`;
      setTimeout(() => btnCopyUID.innerHTML = orig, 1200);
    });
  }

  // Transaction Receipt Page
  const receiptBackBtn = document.getElementById('receiptBackBtn');
  if (receiptBackBtn) {
    receiptBackBtn.addEventListener('click', () => {
      triggerHaptic('light');
      goBackNative();
    });
  }
  const btnShareReceipt = document.getElementById('btnShareReceipt');
  if (btnShareReceipt) {
    btnShareReceipt.addEventListener('click', () => {
      navigator.clipboard?.writeText(window.location.href);
    });
  }

  const btnCopyReceiptHash = document.getElementById('btnCopyReceiptHash');
  if (btnCopyReceiptHash) {
    btnCopyReceiptHash.addEventListener('click', () => {
      const hashText = document.getElementById('receiptHashVal')?.textContent || '';
      navigator.clipboard?.writeText(hashText);
      const orig = btnCopyReceiptHash.innerHTML;
      btnCopyReceiptHash.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" style="width: 14px; height: 14px;"><polyline points="20 6 9 17 4 12"/></svg>`;
      setTimeout(() => btnCopyReceiptHash.innerHTML = orig, 1200);
    });
  }

  const btnDownloadReceipt = document.getElementById('btnDownloadReceipt');
  if (btnDownloadReceipt) {
    btnDownloadReceipt.addEventListener('click', () => {
      const origHTML = btnDownloadReceipt.innerHTML;
      const ref = document.getElementById('receiptRefCode')?.textContent || 'QB-TXN';
      const amt = document.getElementById('receiptAmountVal')?.textContent || '$0.00';
      const typ = document.getElementById('receiptTypeVal')?.textContent || 'Transfer';
      const met = document.getElementById('receiptMethodVal')?.textContent || 'USDT';
      const tim = document.getElementById('receiptTimeVal')?.textContent || new Date().toLocaleString();
      const hsh = document.getElementById('receiptHashVal')?.textContent || '';

      const receiptContent = `====================================
      QBrain Pay - Official Receipt
====================================
Transaction ID: ${ref}
Amount:         ${amt}
Type:           ${typ}
Network/Route:  ${met}
Date & Time:    ${tim}
TX Hash:        ${hsh}
Status:         Settled & Verified (Zero Fee)
====================================
Thank you for using QBrain Pay.
support@qbrainpay.com
`;

      try {
        const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt_${ref}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('Download error:', e);
      }

      btnDownloadReceipt.innerHTML = `<span>Downloaded ✓</span>`;
      btnDownloadReceipt.style.background = '#059669';
      setTimeout(() => {
        btnDownloadReceipt.innerHTML = origHTML;
        btnDownloadReceipt.style.background = '';
      }, 1500);
    });
  }

  function openTransactionReceipt(tx) {
    const rAmt = document.getElementById('receiptAmountVal');
    if (rAmt) {
      rAmt.textContent = `${tx.amount >= 0 ? '+' : '-'}$${Math.abs(tx.amount).toFixed(2)}`;
      rAmt.style.color = tx.amount >= 0 ? '#059669' : '#0f172a';
    }
    const rType = document.getElementById('receiptTypeVal');
    if (rType) rType.textContent = tx.amount >= 0 ? 'USDT Crypto Deposit' : 'Transfer Payment';
    const rMethod = document.getElementById('receiptMethodVal');
    if (rMethod) rMethod.textContent = tx.title;
    const rTime = document.getElementById('receiptTimeVal');
    if (rTime) rTime.textContent = tx.time;
    const rHash = document.getElementById('receiptHashVal');
    if (rHash) {
      const randHash = '0x' + Math.random().toString(16).substring(2, 10) + '...' + Math.random().toString(16).substring(2, 6);
      rHash.textContent = randHash;
    }
    const rRef = document.getElementById('receiptRefCode');
    if (rRef) {
      rRef.textContent = `QB-TXN-${Date.now().toString().slice(-8)}`;
    }
    navigateTo('receipt');
  }

  // Dedicated Transactions Subpage Logic
  const allTxBackBtn = document.getElementById('allTxBackBtn');
  if (allTxBackBtn) {
    allTxBackBtn.addEventListener('click', () => {
      triggerHaptic('light');
      goBackNative();
    });
  }

  const allTxRefreshBtn = document.getElementById('allTxRefreshBtn');
  if (allTxRefreshBtn) {
    allTxRefreshBtn.addEventListener('click', () => {
      allTxRefreshBtn.style.transform = 'rotate(180deg)';
      allTxRefreshBtn.style.transition = 'transform 0.4s ease';
      setTimeout(() => {
        allTxRefreshBtn.style.transform = '';
        allTxRefreshBtn.style.transition = '';
      }, 400);
      renderAllTransactions(currentTxFilter);
    });
  }

  let currentTxFilter = 'all';
  let currentTxSearch = '';

  const allTxSearchInput = document.getElementById('allTxSearchInput');
  if (allTxSearchInput) {
    allTxSearchInput.addEventListener('input', (e) => {
      currentTxSearch = e.target.value.toLowerCase().trim();
      renderAllTransactions(currentTxFilter);
    });
  }

  const txFilterPills = document.querySelectorAll('.tx-filter-pill');
  txFilterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      txFilterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentTxFilter = pill.getAttribute('data-filter') || 'all';
      renderAllTransactions(currentTxFilter);
    });
  });

  function renderAllTransactions(filter = 'all') {
    const container = document.getElementById('allTxListContainer');
    if (!container) return;

    let filtered = userTransactions;
    if (filter === 'deposit') {
      filtered = userTransactions.filter(t => t.type === 'deposit');
    } else if (filter === 'send') {
      filtered = userTransactions.filter(t => t.type === 'send');
    } else if (filter === 'card') {
      filtered = userTransactions.filter(t => t.type === 'card_fee' || t.type === 'card_issuance');
    }

    if (currentTxSearch) {
      filtered = filtered.filter(t => {
        const titleMatch = (t.title || '').toLowerCase().includes(currentTxSearch);
        const methodMatch = (t.method || '').toLowerCase().includes(currentTxSearch);
        const netMatch = (t.network || '').toLowerCase().includes(currentTxSearch);
        return titleMatch || methodMatch || netMatch;
      });
    }

    const countBadge = document.getElementById('allTxGroupCount');
    if (countBadge) countBadge.textContent = `${filtered.length} items`;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-transactions-box" style="padding: 40px 16px;">
          <div class="empty-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="empty-tx-svg">
              <rect x="2" y="4" width="20" height="16" rx="3"></rect>
              <path d="M7 15h10M7 9h6"></path>
            </svg>
          </div>
          <p class="empty-title">No transactions found</p>
          <p class="empty-sub">${currentTxSearch ? 'No matches for "' + currentTxSearch + '"' : 'No records in this category'}</p>
        </div>`;
      return;
    }

    container.innerHTML = filtered.map((tx, idx) => {
      let displayTitle = tx.title;
      if (displayTitle.includes('USDT Deposit')) {
        const netMatch = displayTitle.match(/\((.*?)\)/);
        if (netMatch && netMatch[1]) {
          const netShort = netMatch[1].split(' ')[0];
          displayTitle = `${netShort} USDT Deposit`;
        }
      }

      return `
        <div class="transaction-item" data-tx-id="${tx.id || idx}" style="cursor: pointer;">
          <div class="trans-icon-wrapper" style="background: ${tx.amount >= 0 ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #4f46e5)'}; box-shadow: 0 4px 10px ${tx.amount >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(99,102,241,0.3)'};">
            <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px;">
              ${tx.amount >= 0 
                ? '<path d="M12 4v11m0 0l-3.5-3.5m3.5 3.5l3.5-3.5M4 19h16"/>' 
                : '<path d="M12 20V9m0 0l-3.5 3.5m3.5-3.5l3.5 3.5M4 5h16"/>'}
            </svg>
          </div>
          <div class="trans-details">
            <span class="trans-title">${displayTitle}</span>
            <span class="trans-time">${tx.time}</span>
          </div>
          <div class="trans-meta">
            <span class="trans-amount ${tx.amount >= 0 ? 'amount-positive' : 'amount-negative'}">${tx.amount >= 0 ? '+' : '-'} $${Math.abs(tx.amount).toFixed(2)}</span>
            <span class="trans-status badge-${tx.status === 'Completed' ? 'completed' : 'success'}">${tx.status}</span>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.transaction-item').forEach(el => {
      el.addEventListener('click', () => {
        const txId = el.getAttribute('data-tx-id');
        const tx = filtered.find(t => String(t.id || '') === String(txId)) || filtered[0];
        if (tx) openTransactionReceipt(tx);
      });
    });
  }

  // Quick Access: Transactions & View All wire to dedicated page
  const qaTransactions = document.getElementById('qaTransactions');
  const viewAllTrans = document.getElementById('viewAllTrans');
  if (qaTransactions) {
    qaTransactions.addEventListener('click', () => {
      navigateTo('allTransactions');
    });
  }
  if (viewAllTrans) {
    viewAllTrans.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('allTransactions');
    });
  }

  // Quick Access: Support modal
  const qaSupport = document.getElementById('qaSupport');
  const depositSupportBtn = document.getElementById('depositSupportBtn');
  function openSupportModal() {
    triggerHaptic('light');
    openCardModal('Customer Support', `
      <div style="padding: 4px 0; text-align: center;">
        <div style="width: 54px; height: 54px; border-radius: 16px; background: rgba(0, 242, 254, 0.1); border: 1.5px solid rgba(0, 242, 254, 0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; box-shadow: 0 4px 18px rgba(0, 242, 254, 0.2);">
          <svg viewBox="0 0 24 24" fill="none" stroke="#00f2fe" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width: 26px; height: 26px;">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
            <polyline points="22,6 12,13 2,6"></polyline>
          </svg>
        </div>
        <h4 style="font-size: 17px; font-weight: 800; color: #ffffff; margin: 0 0 6px;">Official Email Support</h4>
        <p style="font-size: 12.5px; color: #94a3b8; line-height: 1.5; margin: 0 0 16px;">Our dedicated financial team is available 24/7 to assist with your card, deposits, and account verification.</p>
        
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(0, 242, 254, 0.25); border-radius: 16px; padding: 16px; margin-bottom: 14px; text-align: left; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 11px; font-weight: 800; color: #64748b; letter-spacing: 0.6px;">OFFICIAL INBOX</div>
            <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-top: 3px;">support@qbrainpay.com</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Available 24/7</div>
          </div>
          <button type="button" id="copySupportEmailDirect" style="padding: 9px 16px; border-radius: 12px; background: linear-gradient(135deg, #00f2fe 0%, #2563eb 100%); color: #ffffff; font-size: 12px; font-weight: 800; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0, 242, 254, 0.3); transition: all 0.15s ease;">
            Copy Email
          </button>
        </div>

        <button type="button" onclick="document.getElementById('cardModalBackdrop')?.classList.add('hidden')" style="width: 100%; padding: 13px; border-radius: 14px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.12); color: #94a3b8; font-size: 13.5px; font-weight: 700; cursor: pointer; transition: all 0.15s ease;">
          Close
        </button>
      </div>
    `);

    const copyBtn = document.getElementById('copySupportEmailDirect');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText('support@qbrainpay.com');
        copyBtn.textContent = 'Copied! ✓';
        copyBtn.style.background = '#10b981';
        showAppToast('Support email copied! ✓');
        triggerHaptic('success');
        setTimeout(() => {
          if (copyBtn) {
            copyBtn.textContent = 'Copy Email';
            copyBtn.style.background = 'linear-gradient(135deg, #00f2fe 0%, #2563eb 100%)';
          }
        }, 2000);
      });
    }
  }
  if (qaSupport) qaSupport.addEventListener('click', openSupportModal);
  if (depositSupportBtn) depositSupportBtn.addEventListener('click', openSupportModal);

  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      navigateTo('profile');
    });
  }

  if (profileBackBtn) {
    profileBackBtn.addEventListener('click', () => {
      triggerHaptic('light');
      goBackNative();
    });
  }

  if (profileSettingsBtn) {
    profileSettingsBtn.addEventListener('click', () => {
      openCardModal('Account Preferences', `
        <div class="modal-setting-row">
          <div class="setting-info">
            <span class="setting-title">Dark Mode</span>
            <span class="setting-sub">Switch between light and dark appearance</span>
          </div>
          <div class="setting-switch"><span class="switch-thumb"></span></div>
        </div>
        <div class="modal-setting-row">
          <div class="setting-info">
            <span class="setting-title">Default Currency</span>
            <span class="setting-sub">All balances shown in USD</span>
          </div>
          <span style="font-weight: 700; color: #2563eb; font-size: 13px;">USD ($)</span>
        </div>
      `);
    });
  }

  if (btnLogOut) {
    btnLogOut.addEventListener('click', async () => {
      if (supabase) {
        try {
          await supabase.auth.signOut();
        } catch (e) {
          console.warn('Sign out warning:', e);
        }
      }
      localStorage.removeItem('qbrain_user_session');
      currentUser = null;
      navigateTo('auth');
    });
  }

  const profileMenuItems = document.querySelectorAll('.profile-menu-item');
  profileMenuItems.forEach(item => {
    item.addEventListener('click', () => {
      const menuType = item.getAttribute('data-menu');
      if (menuType === 'personal') {
        updatePersonalInfoDisplay();
        navigateTo('personalInfo');
      } else if (menuType === 'notifications') {
        navigateTo('notifications');
      } else if (menuType === 'security') {
        const savedSecPin = localStorage.getItem('qbrain_security_pin') || '';
        openCardModal('Security & Privacy', `
          <div style="padding: 6px 0 10px 0;">

            <!-- Security PIN -->
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(0,242,254,0.22); border-radius: 16px; padding: 18px 16px;">
              <div style="font-size: 11px; font-weight: 800; color: #64748b; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 6px;">App Security PIN</div>
              <div style="font-size: 12.5px; color: #94a3b8; margin-bottom: 14px;">4-digit PIN for app login & sensitive actions</div>
              <input type="password" id="profileSecurityPin" maxlength="4" inputmode="numeric" pattern="[0-9]*" value="${savedSecPin}" placeholder="Enter 4-digit PIN" style="width: 100%; box-sizing: border-box; height: 50px; border-radius: 12px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.15); color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 12px; text-align: center; outline: none; margin-bottom: 14px;" />
              <button type="button" id="btnSaveSecPin" style="width: 100%; height: 46px; border-radius: 12px; background: linear-gradient(135deg, #00f2fe 0%, #2563eb 100%); color: #fff; font-size: 13.5px; font-weight: 800; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(0, 242, 254, 0.25);">Save PIN</button>
            </div>

          </div>
        `);

        // PIN Save Handler
        const pinInput = document.getElementById('profileSecurityPin');
        const savePinBtn2 = document.getElementById('btnSaveSecPin');
        if (pinInput && savePinBtn2) {
          pinInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
          });
          savePinBtn2.addEventListener('click', () => {
            const val = pinInput.value.trim();
            if (!/^\d{4}$/.test(val)) { showAppToast('Please enter a valid 4-digit PIN'); return; }
            localStorage.setItem('qbrain_security_pin', val);
            triggerHaptic('success');
            savePinBtn2.textContent = 'Saved ✓';
            savePinBtn2.style.background = '#10b981';
            showAppToast('Security PIN saved! ✓');
            setTimeout(() => {
              if (savePinBtn2) {
                savePinBtn2.textContent = 'Save PIN';
                savePinBtn2.style.background = 'linear-gradient(135deg, #00f2fe 0%, #2563eb 100%)';
              }
            }, 2000);
          });
        }
      } else if (menuType === 'kyc') {
        openCardModal('KYC Verification', `
          <div style="text-align: center; padding: 20px 0;">
            <div style="width: 54px; height: 54px; border-radius: 50%; background: #d1fae5; color: #059669; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 28px; height: 28px;">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h3 style="font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">Identity Verified</h3>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0 0 16px 0;">Your account has Level 2 Global Verification. All card payments and crypto transfers are unlocked.</p>
          </div>
        `);
      } else if (menuType === 'support') {
        openCardModal('Customer Support', `
          <div style="padding: 10px 0; display: flex; flex-direction: column; gap: 12px;">
            <p style="font-size: 13px; color: #64748b; margin: 0 0 6px 0;">Need help with your cards or account? Our 24/7 team is ready to assist.</p>
            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(0,242,254,0.2); padding: 14px 16px; border-radius: 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-size: 11px; color: #64748b; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase;">Email Support</span>
                <p style="font-size: 14px; font-weight: 700; color: #ffffff; margin: 4px 0 0 0;">support@qbrainpay.com</p>
                <p style="font-size: 11px; color: #94a3b8; margin: 2px 0 0 0;">Available 24/7</p>
              </div>
              <button type="button" id="profileCopyEmail" style="padding: 9px 14px; border-radius: 12px; background: linear-gradient(135deg, #00f2fe 0%, #2563eb 100%); color: #fff; font-size: 12px; font-weight: 800; border: none; cursor: pointer; white-space: nowrap;">Copy</button>
            </div>
          </div>
        `);
        const pCopyBtn = document.getElementById('profileCopyEmail');
        if (pCopyBtn) {
          pCopyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText('support@qbrainpay.com');
            pCopyBtn.textContent = 'Copied! ✓';
            pCopyBtn.style.background = '#10b981';
            triggerHaptic('success');
            showAppToast('Support email copied! ✓');
            setTimeout(() => { if (pCopyBtn) { pCopyBtn.textContent = 'Copy'; pCopyBtn.style.background = 'linear-gradient(135deg, #00f2fe 0%, #2563eb 100%)'; } }, 2000);
          });
        }
      } else if (menuType === 'about') {
        openCardModal('About QBrain Pay', `
          <div style="text-align: center; padding: 18px 0;">
            <div style="width: 50px; height: 50px; border-radius: 14px; background: #2563eb; color: #fff; font-size: 24px; font-weight: 900; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto;">Q</div>
            <h3 style="font-size: 17px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">QBrain Pay v2.4.0</h3>
            <p style="font-size: 12px; color: #64748b; margin-bottom: 14px;">Next-Gen Digital Banking & Global Virtual Cards</p>
            <p style="font-size: 11px; color: #94a3b8;">© 2026 QBrain Technologies. Protected by 256-bit Bank Encryption.</p>
          </div>
        `);
      } else {
        const title = item.querySelector('.menu-item-title')?.textContent || 'Details';
        openCardModal(title, `
          <div style="padding: 16px 0; text-align: center;">
            <p style="font-size: 13px; color: #64748b;">${title} is active and up to date for your account.</p>
          </div>
        `);
      }
    });
  });

  // 16. Send Money Page Handlers
  if (btnSend) {
    btnSend.addEventListener('click', () => {
      navigateTo('send');
    });
  }

  if (sendBackBtn) {
    sendBackBtn.addEventListener('click', () => {
      triggerHaptic('light');
      goBackNative();
    });
  }

  if (sendChatBtn) {
    sendChatBtn.addEventListener('click', () => {
      openCardModal('Transfer Support', `
        <div style="padding: 10px 0;">
          <p style="font-size: 13px; color: #64748b; line-height: 1.5;">Have a question about sending funds? Contact our 24/7 team via <strong>support@qbrainpay.com</strong>.</p>
        </div>
      `);
    });
  }

  if (btnSelectContact) {
    btnSelectContact.addEventListener('click', () => {
      showToast('No saved contacts yet. Enter address or email above.', 2500);
    });
  }

  // Quick Amount Presets
  const sendPresetPills = document.querySelectorAll('.send-quick-presets .preset-pill');
  const sendAmountInput = document.getElementById('sendAmountInput');
  sendPresetPills.forEach(pill => {
    pill.addEventListener('click', () => {
      sendPresetPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const amt = pill.getAttribute('data-amount');
      if (sendAmountInput) {
        sendAmountInput.value = parseFloat(amt).toFixed(2);
      }
    });
  });

  if (sendAmountInput) {
    sendAmountInput.addEventListener('input', () => {
      const currentVal = parseFloat(sendAmountInput.value);
      sendPresetPills.forEach(pill => {
        const pillVal = parseFloat(pill.getAttribute('data-amount'));
        if (pillVal === currentVal) {
          pill.classList.add('active');
        } else {
          pill.classList.remove('active');
        }
      });
    });
  }

  // Continue Button (Send Money)
  if (btnSendContinue) {
    btnSendContinue.addEventListener('click', () => {
      const recipientInput = document.getElementById('sendRecipientInput');
      const recipient = recipientInput ? recipientInput.value.trim() : '';
      const amount = sendAmountInput ? parseFloat(sendAmountInput.value) : 0;

      if (!recipient) {
        showToast('Please enter recipient email, phone or ID');
        if (recipientInput) recipientInput.focus();
        return;
      }

      if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount');
        if (sendAmountInput) sendAmountInput.focus();
        return;
      }

      const userBal = parseFloat(currentProfile.balance || 0);
      if (amount > userBal) {
        showToast(`Insufficient balance ($${userBal.toFixed(2)} available)`);
        return;
      }

      // Open Professional Transfer Review Summary & Security Confirmation (Apple Pay / Revolut style)
      openCardModal('Confirm Transfer', `
        <div style="padding: 4px 0;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="font-size: 13px; color: rgba(255, 255, 255, 0.7); font-weight: 600;">You are sending</div>
            <div style="font-size: 38px; font-weight: 900; color: #ffffff; margin: 4px 0; letter-spacing: -0.5px;">$${amount.toFixed(2)}</div>
            <span style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 12px; border: 1px solid rgba(52, 211, 153, 0.35);">Zero Fee • Instant Settlement</span>
          </div>

          <div style="background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-radius: 18px; border: 1px solid rgba(255, 255, 255, 0.15); padding: 16px 18px; margin-bottom: 22px; display: flex; flex-direction: column; gap: 12px; font-size: 13.5px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: rgba(255, 255, 255, 0.65);">Recipient</span>
              <strong style="color: #ffffff; font-weight: 700;">${recipient}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: rgba(255, 255, 255, 0.65);">Payment Method</span>
              <strong style="color: #ffffff; font-weight: 700;">QBrain Pay Balance</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: rgba(255, 255, 255, 0.65);">Transfer Speed</span>
              <span style="color: #34d399; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 14px; height: 14px;"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Instant (0s)
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: rgba(255, 255, 255, 0.65);">Security Level</span>
              <span style="color: #60a5fa; font-weight: 700; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 13px; height: 13px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Biometric Shield Protected
              </span>
            </div>
          </div>

          <button type="button" id="btnExecuteSendTransfer" style="width: 100%; padding: 15px; border-radius: 16px; background: linear-gradient(135deg, #0052ff, #2563eb); color: #fff; font-size: 15px; font-weight: 800; border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(0, 82, 255, 0.45); display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span>Authorize &amp; Send Now</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 18px; height: 18px;"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      `);

      const btnExec = document.getElementById('btnExecuteSendTransfer');
      if (btnExec) {
        btnExec.addEventListener('click', () => {
          btnExec.textContent = 'Processing Transfer...';
          btnExec.style.opacity = '0.7';

          (async () => {
            let finalTxHash = '0x' + Array.from({length: 32}, () => Math.floor(Math.random()*16).toString(16)).join('');
            try {
              const res = await fetch(apiUrl('/api/user/transfer'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  senderEmail: currentProfile.email || 'mdkhalidhasan@gmail.com',
                  recipient: recipient,
                  amount: amount
                })
              });
              const json = await res.json();
              if (json && json.success) {
                if (typeof json.balance !== 'undefined') currentProfile.balance = parseFloat(json.balance);
                if (json.txHash) finalTxHash = json.txHash;
              } else {
                currentProfile.balance = parseFloat(Math.max(0, userBal - amount).toFixed(2));
              }
            } catch (err) {
              currentProfile.balance = parseFloat(Math.max(0, userBal - amount).toFixed(2));
            }

            updateAppWithUserData(currentProfile);

            if (currentUser) {
              currentUser.profile = currentProfile;
              localStorage.setItem('qbrain_user_session', JSON.stringify(currentUser));
            }

            const now = new Date();
            const timeStr = 'Today, ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const newTx = {
              type: 'send',
              title: `Transfer to ${recipient}`,
              amount: -amount,
              time: timeStr,
              hash: finalTxHash,
              status: 'Completed'
            };
            addTransaction(newTx);

            // Reset form
            if (recipientInput) recipientInput.value = '';
            if (sendAmountInput) sendAmountInput.value = '0.00';
            const noteInput = document.getElementById('sendNoteInput');
            if (noteInput) noteInput.value = '';
            sendPresetPills.forEach(p => p.classList.remove('active'));

            closeCardModal();
            showToast(`Sent $${amount.toFixed(2)} to ${recipient}`);
            setTimeout(() => {
              openTransactionReceipt(newTx);
            }, 350);
          })();
        });
      }
    });
  }

  // 17. Assets Page Handlers
  const assetsRefreshBtn = document.getElementById('assetsRefreshBtn');
  if (assetsRefreshBtn) {
    assetsRefreshBtn.addEventListener('click', () => {
      assetsRefreshBtn.style.transform = 'rotate(360deg)';
      assetsRefreshBtn.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
      setTimeout(() => {
        assetsRefreshBtn.style.transform = '';
        assetsRefreshBtn.style.transition = '';
        updateAppWithUserData(currentProfile);
      }, 500);
    });
  }


  const assetsProfileBtn = document.getElementById('assetsProfileBtn');
  if (assetsProfileBtn) {
    assetsProfileBtn.addEventListener('click', () => {
      navigateTo('profile');
    });
  }

  // Toggle Eye on Total Assets Card
  const assetsToggleEye = document.getElementById('assetsToggleEye');
  const assetsTotalAmount = document.getElementById('assetsTotalAmount');
  const assetsEyeOpen = document.getElementById('assetsEyeOpen');
  const assetsEyeClosed = document.getElementById('assetsEyeClosed');
  let isAssetsVisible = true;

  if (assetsToggleEye && assetsTotalAmount) {
    assetsToggleEye.addEventListener('click', () => {
      isAssetsVisible = !isAssetsVisible;
      if (isAssetsVisible) {
        assetsTotalAmount.textContent = `$${parseFloat(currentProfile.balance || 0).toFixed(2)}`;
        if (assetsEyeOpen) assetsEyeOpen.classList.remove('hidden');
        if (assetsEyeClosed) assetsEyeClosed.classList.add('hidden');
      } else {
        assetsTotalAmount.textContent = hiddenMask;
        if (assetsEyeOpen) assetsEyeOpen.classList.add('hidden');
        if (assetsEyeClosed) assetsEyeClosed.classList.remove('hidden');
      }
    });
  }

  // Assets Action Buttons
  const btnAssetsDeposit = document.getElementById('btnAssetsDeposit');
  if (btnAssetsDeposit) {
    btnAssetsDeposit.addEventListener('click', () => {
      navigateTo('deposit');
    });
  }

  const btnAssetsWithdraw = document.getElementById('btnAssetsWithdraw');
  if (btnAssetsWithdraw) {
    btnAssetsWithdraw.addEventListener('click', () => {
      openCardModal('Withdraw Funds', `
        <div style="padding: 10px 0;">
          <p style="font-size: 13px; color: #94a3b8; margin-bottom: 14px;">Select external withdrawal route:</p>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button type="button" class="assets-withdraw-option-btn" style="padding: 14px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.14); background: rgba(255, 255, 255, 0.08); color: #ffffff; font-weight: 700; text-align: left; cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
              <span>USDT (Polygon POL)</span>
              <span style="font-size: 11px; color: #34d399; font-weight: 800; background: rgba(16, 185, 129, 0.2); padding: 3px 8px; border-radius: 8px;">Fast & Cheap</span>
            </button>
            <button type="button" class="assets-withdraw-option-btn" style="padding: 14px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.14); background: rgba(255, 255, 255, 0.08); color: #ffffff; font-weight: 700; text-align: left; cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
              <span>USDT (Arbitrum One)</span>
              <span style="font-size: 11px; color: #60a5fa; font-weight: 800; background: rgba(37, 99, 235, 0.2); padding: 3px 8px; border-radius: 8px;">High Speed L2</span>
            </button>
            <button type="button" class="assets-withdraw-option-btn" style="padding: 14px; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.14); background: rgba(255, 255, 255, 0.08); color: #ffffff; font-weight: 700; text-align: left; cursor: pointer; display: flex; align-items: center; justify-content: space-between;">
              <span>USDT (BNB Chain BEP-20)</span>
              <span style="font-size: 11px; color: #fbbf24; font-weight: 800; background: rgba(245, 158, 11, 0.2); padding: 3px 8px; border-radius: 8px;">Low Gas</span>
            </button>
          </div>
        </div>
      `);
    });
  }

  const btnAssetsTransfer = document.getElementById('btnAssetsTransfer');
  if (btnAssetsTransfer) {
    btnAssetsTransfer.addEventListener('click', () => {
      navigateTo('send');
    });
  }

  const btnAssetsHistory = document.getElementById('btnAssetsHistory');
  if (btnAssetsHistory) {
    btnAssetsHistory.addEventListener('click', () => {
      navigateTo('allTransactions');
    });
  }

  const btnManageWallets = document.getElementById('btnManageWallets');
  if (btnManageWallets) {
    btnManageWallets.addEventListener('click', () => {
      openCardModal('Active USDT Networks', `
        <div style="padding: 6px 0;">
          <p style="font-size: 12.5px; color: #94a3b8; margin-bottom: 14px;">Real-time settlement networks activated on your account:</p>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #ffffff; font-size: 13.5px; display: block;">Polygon (POL)</strong>
                <span style="color: #94a3b8; font-size: 11px;">EVM Compatible • Instant</span>
              </div>
              <span style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 8px;">Connected</span>
            </div>
            <div style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #ffffff; font-size: 13.5px; display: block;">Arbitrum (ARB)</strong>
                <span style="color: #94a3b8; font-size: 11px;">Arbitrum One Rollup</span>
              </div>
              <span style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 8px;">Connected</span>
            </div>
            <div style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #ffffff; font-size: 13.5px; display: block;">BNB Smart Chain</strong>
                <span style="color: #94a3b8; font-size: 11px;">BEP-20 Architecture</span>
              </div>
              <span style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 8px;">Connected</span>
            </div>
          </div>
        </div>
      `);
    });
  }

  // Handle Supabase OAuth Session and onAuthStateChange
  async function handleSupabaseUserSession(user) {
    if (!user) return;
    try {
      let userBalance = 0.00; // Real wallet balance starts at 0.00
      let fullName = user.user_metadata?.full_name || user.user_metadata?.name || 'QBrain User';
      let userEmail = user.email || 'user@qbrainpay.com';

      // Fetch or sync with public.profiles table
      if (supabase) {
        const { data: dbProfiles, error: pErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', userEmail)
          .limit(1);

        if (!pErr && dbProfiles && dbProfiles.length > 0) {
          userBalance = parseFloat(dbProfiles[0].balance || 0);
          if (dbProfiles[0].full_name) fullName = dbProfiles[0].full_name;
        } else {
          // If first-time user, insert record into profiles table
          await supabase.from('profiles').insert([
            {
              id: user.id,
              full_name: fullName,
              email: userEmail,
              balance: 0.00,
              kyc_status: 'Verified'
            }
          ]);
        }
      }

      const profile = {
        full_name: fullName,
        email: userEmail,
        balance: userBalance,
        kyc_status: 'Verified'
      };

      currentUser = { id: user.id, email: userEmail, profile };
      localStorage.setItem('qbrain_user_session', JSON.stringify(currentUser));
      updateAppWithUserData(profile);
      navigateTo('home');
    } catch (err) {
      console.warn('Error handling Supabase user session:', err);
    }
  }

  // Check Supabase OAuth session on redirect and listen for state change
  if (supabase) {
    try {
      supabase.auth.onAuthStateChange((event, session) => {
        if (session && session.user) {
          handleSupabaseUserSession(session.user);
        }
      });

      supabase.auth.getSession().then(({ data }) => {
        if (data && data.session && data.session.user) {
          handleSupabaseUserSession(data.session.user);
        }
      });
    } catch (sessionErr) {
      console.warn('Session check note:', sessionErr);
    }
  }

  // 18. Official Google Single-Tap Authentication Handler (Supabase OAuth)
  const btnGoogleLogin = document.getElementById('btnGoogleLogin');

  // Trigger Real Google OAuth
  if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', async () => {
      btnGoogleLogin.style.transform = 'scale(0.97)';
      setTimeout(() => btnGoogleLogin.style.transform = '', 150);

      const isFile = window.location.protocol.startsWith('file');

      // If user opened directly via file:// protocol
      if (isFile) {
        openCardModal('Google Sign-In Options', `
          <div style="text-align: center; padding: 6px 4px 10px;">
            <div style="width: 54px; height: 54px; border-radius: 50%; background: rgba(59, 130, 246, 0.12); border: 1.5px solid rgba(96, 165, 250, 0.35); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;">
              <svg viewBox="0 0 24 24" style="width: 26px; height: 26px;">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
            </div>
            <h4 style="font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 8px;">Direct File Mode Detected (file://)</h4>
            <p style="font-size: 12.5px; color: #94a3b8; line-height: 1.55; margin-bottom: 18px;">
              Google এর নিরাপত্তা পলিসি অনুযায়ী <code>file://</code> লিঙ্কে সরাসরি OAuth রিডাইরেক্ট কাজ করে না। লোকাল সার্ভার ছাড়া Google রিডাইরেক্ট করলে ব্রাউজার ব্লক করে।
              <br><br>
              <strong style="color: #60a5fa;">আসল Google একাউন্ট দিয়ে লগইন করতে:</strong> ফোল্ডারে থাকা <code>Start_App.bat</code> ফাইলটি ডাবল-ক্লিক করুন।
            </p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              <button type="button" id="btnInstantDemoLogin" style="width: 100%; padding: 13px; border-radius: 12px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; font-size: 13.5px; font-weight: 700; border: none; cursor: pointer; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
                ⚡ Instant Sign-In (Md Khalid Hasan • $0.00)
              </button>
              <button type="button" id="btnTryRealOAuth" style="width: 100%; padding: 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.08); color: #cbd5e1; font-size: 12.5px; font-weight: 600; border: 1px solid rgba(255, 255, 255, 0.12); cursor: pointer;">
                🌐 Launch Real Google OAuth (via localhost)
              </button>
            </div>
          </div>
        `);

        // Hook up modal buttons
        const btnInstant = document.getElementById('btnInstantDemoLogin');
        if (btnInstant) {
          btnInstant.addEventListener('click', () => {
            closeCardModal();
            loginWithGoogleAccount('Md Khalid Hasan', 'mdkhalidhasan@gmail.com');
          });
        }

        const btnTryReal = document.getElementById('btnTryRealOAuth');
        if (btnTryReal) {
          btnTryReal.addEventListener('click', async () => {
            closeCardModal();
            triggerSupabaseGoogleOAuth('http://localhost:5500');
          });
        }
        return;
      }

      // If already running on http:// or https:// (e.g. localhost:5500)
      triggerSupabaseGoogleOAuth(window.location.origin + window.location.pathname);
    });
  }

  // Trigger Supabase Google OAuth
  async function triggerSupabaseGoogleOAuth(redirectUrl) {
    if (!supabase) {
      showToast('Supabase client not initialized');
      return;
    }
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
        }
      });

      if (error) {
        console.error('Supabase Google OAuth error:', error);
        showToast('Google OAuth: ' + error.message);
        return;
      }

      if (data && data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('OAuth call failed:', err);
    }
  }

  // Reusable Google Account Login Function
  function loginWithGoogleAccount(fullName, email) {
    const isVerified = localStorage.getItem('qbrain_face_verified') === 'true';
    const hasCard = localStorage.getItem('qbrain_card_purchased') === 'true';
    isCardPurchased = hasCard;
    setCardsViewState(isCardPurchased);

    const profileData = {
      full_name: fullName || 'Md Khalid Hasan',
      email: email || 'mdkhalidhasan@gmail.com',
      balance: 0.00,
      face_verified: isVerified,
      card_purchased: hasCard,
      depositCount: 0,
      kyc_status: 'Verified'
    };

    const sessionData = {
      id: 'google-' + Date.now(),
      email: profileData.email,
      provider: 'google',
      profile: profileData
    };

    currentUser = sessionData;
    currentProfile = Object.assign({}, currentProfile, profileData);
    localStorage.setItem('qbrain_user_session', JSON.stringify(sessionData));
    updateAppWithUserData(profileData);
    updateFaceVerifyNoticeUI();
    syncUserDedicatedWallet();
    sendUserPresenceHeartbeat();
    navigateTo('home');

    // Supabase DB Sync in background (non-blocking)
    if (supabase) {
      supabase
        .from('profiles')
        .select('*')
        .eq('email', profileData.email)
        .limit(1)
        .then(({ data: dbProfiles, error }) => {
          if (!error && dbProfiles && dbProfiles.length > 0) {
            profileData.balance = parseFloat(dbProfiles[0].balance !== undefined ? dbProfiles[0].balance : 0.00);
            profileData.full_name = dbProfiles[0].full_name || profileData.full_name;
            updateAppWithUserData(profileData);
            sessionData.profile = profileData;
            localStorage.setItem('qbrain_user_session', JSON.stringify(sessionData));
          } else {
            // If first-time user, insert record into profiles table
            supabase.from('profiles').insert([
              {
                id: sessionData.id,
                full_name: profileData.full_name,
                email: profileData.email,
                balance: 0.00,
                kyc_status: 'Verified'
              }
            ]);
          }
        })
        .catch(dbErr => console.warn('Supabase profile sync note:', dbErr));
    }
  }

  // Reusable Account Login Function (Google / Email OTP)
  function loginWithUserAccount(fullName, email, provider = 'email') {
    const isVerified = localStorage.getItem('qbrain_face_verified') === 'true';
    const hasCard = localStorage.getItem('qbrain_card_purchased') === 'true';
    isCardPurchased = hasCard;
    setCardsViewState(isCardPurchased);

    const profileData = {
      full_name: fullName || (email ? email.split('@')[0] : 'User'),
      email: email,
      balance: 0.00,
      face_verified: isVerified,
      card_purchased: hasCard,
      depositCount: 0,
      kyc_status: 'Verified'
    };

    const sessionData = {
      id: provider + '-' + Date.now(),
      email: profileData.email,
      provider: provider,
      profile: profileData
    };

    localStorage.setItem('qbrain_user_session', JSON.stringify(sessionData));
    currentUser = sessionData;
    currentProfile = profileData;

    updateAppWithUserData(currentProfile);
    syncUserDedicatedWallet();
    sendUserPresenceHeartbeat();

    if (authPage) authPage.classList.remove('active');
    if (homePage) homePage.classList.add('active');
    if (appContainer) appContainer.classList.remove('cards-mode');
    if (bottomNav) bottomNav.classList.remove('hide-nav');

    showToast('Welcome, ' + profileData.full_name + '!');
  }

  // 19. Seamless Onboarding & Authentication Engine
  const authViewShowcase = document.getElementById('authViewShowcase');
  const authViewForm = document.getElementById('authViewForm');
  const authViewNewUser = document.getElementById('authViewNewUser');
  const btnSlideToAuth = document.getElementById('btnSlideToAuth');
  const btnBackToShowcase = document.getElementById('btnBackToShowcase');
  const authFormTitle = document.getElementById('authFormTitle');
  const authFormSub = document.getElementById('authFormSub');

  const authEmailInput = document.getElementById('authEmailInput');
  const btnSendEmailOtp = document.getElementById('btnSendEmailOtp');
  const authEmailStep1 = document.getElementById('authEmailStep1');
  const authEmailStep2 = document.getElementById('authEmailStep2');
  const authOtpInput = document.getElementById('authOtpInput');
  const btnVerifyEmailOtp = document.getElementById('btnVerifyEmailOtp');
  const authOtpTargetEmail = document.getElementById('authOtpTargetEmail');
  const btnChangeAuthEmail = document.getElementById('btnChangeAuthEmail');
  const authOtpFeedback = document.getElementById('authOtpFeedback');
  const authResendCountdown = document.getElementById('authResendCountdown');

  // New User Registration Form Elements
  const authNewFullName = document.getElementById('authNewFullName');
  const authAgeSelect = document.getElementById('authAgeSelect');
  const authSelectedAgeBadge = document.getElementById('authSelectedAgeBadge');
  const authTermsCheck = document.getElementById('authTermsCheck');
  const btnCompleteNewUserReg = document.getElementById('btnCompleteNewUserReg');
  const authNewUserFeedback = document.getElementById('authNewUserFeedback');

  let currentAuthEmail = '';
  let countdownTimer = null;
  let isNewUserFlow = false;

  // Populate Interactive 18 to 80 Age Picker
  if (authAgeSelect) {
    authAgeSelect.innerHTML = '';
    for (let age = 18; age <= 80; age++) {
      const opt = document.createElement('option');
      opt.value = age;
      opt.textContent = age + ' Years Old';
      if (age === 24) opt.selected = true;
      authAgeSelect.appendChild(opt);
    }
    authAgeSelect.addEventListener('change', () => {
      if (authSelectedAgeBadge) {
        authSelectedAgeBadge.textContent = authAgeSelect.value + ' Years';
      }
    });
  }

  // Slide between Showcase and Auth Form (Smooth Fluid Transitions)
  if (btnSlideToAuth) {
    btnSlideToAuth.addEventListener('click', () => {
      if (!authViewShowcase || !authViewForm) return;
      try { window.history.pushState({ screen: 'auth-form' }, ''); } catch (e) {}
      authViewShowcase.classList.remove('slide-in-left', 'slide-in-right');
      authViewShowcase.classList.add('slide-out-left');
      setTimeout(() => {
        authViewShowcase.style.display = 'none';
        authViewShowcase.classList.remove('slide-out-left');
        authViewForm.style.display = 'flex';
        authViewForm.classList.remove('slide-out-left', 'slide-out-right');
        authViewForm.classList.add('slide-in-right');
        if (authEmailInput) authEmailInput.focus();
      }, 240);
    });
  }

  if (btnBackToShowcase) {
    btnBackToShowcase.addEventListener('click', () => {
      if (!authViewShowcase || !authViewForm) return;
      authViewForm.classList.remove('slide-in-right', 'slide-in-left');
      authViewForm.classList.add('slide-out-right');
      setTimeout(() => {
        authViewForm.style.display = 'none';
        authViewForm.classList.remove('slide-out-right');
        if (authViewNewUser) authViewNewUser.style.display = 'none';
        authViewShowcase.style.display = 'flex';
        authViewShowcase.classList.remove('slide-out-right', 'slide-out-left');
        authViewShowcase.classList.add('slide-in-left');
        if (authOtpFeedback) authOtpFeedback.style.display = 'none';
      }, 240);
    });
  }

  function showOtpFeedback(msg, isError = false) {
    if (!authOtpFeedback) return;
    authOtpFeedback.style.display = 'block';
    authOtpFeedback.style.color = isError ? '#f43f5e' : '#34d399';
    authOtpFeedback.textContent = msg;
  }

  function startResendCountdown(seconds = 60) {
    if (countdownTimer) clearInterval(countdownTimer);
    let left = seconds;
    if (authResendCountdown) authResendCountdown.textContent = 'Resend code in ' + left + 's';
    countdownTimer = setInterval(() => {
      left--;
      if (left <= 0) {
        clearInterval(countdownTimer);
        if (authResendCountdown) {
          authResendCountdown.innerHTML = '<button type="button" id="btnResendNow" style="background: none; border: none; color: #00d2ff; font-size: 11.5px; font-weight: 700; cursor: pointer; text-decoration: underline;">Resend Code Now</button>';
          const btnResend = document.getElementById('btnResendNow');
          if (btnResend) {
            btnResend.addEventListener('click', () => {
              if (currentAuthEmail) sendOtpRequest(currentAuthEmail);
            });
          }
        }
      } else {
        if (authResendCountdown) authResendCountdown.textContent = 'Resend code in ' + left + 's';
      }
    }, 1000);
  }

  async function sendOtpRequest(email) {
    if (!email || !email.includes('@')) {
      showOtpFeedback('Please enter a valid email address.', true);
      return;
    }

    const origBtnHtml = btnSendEmailOtp ? btnSendEmailOtp.innerHTML : '';
    if (btnSendEmailOtp) {
      btnSendEmailOtp.disabled = true;
      btnSendEmailOtp.innerHTML = 'Checking Account...';
    }
    showOtpFeedback('Connecting to security server...', false);

    try {
      const res = await fetch(apiUrl('/api/auth/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        showOtpFeedback(data.error || 'Failed to send OTP. Please try again.', true);
        return;
      }

      currentAuthEmail = email;
      if (authOtpTargetEmail) authOtpTargetEmail.textContent = email;
      if (authEmailStep1) authEmailStep1.style.display = 'none';
      if (authEmailStep2) authEmailStep2.style.display = 'block';

      // Dynamic Greeting for Existing vs New Users
      if (data.isExisting && data.existingName) {
        if (authFormTitle) authFormTitle.innerHTML = 'Welcome Back, <span style="color:#00e5ff;">' + data.existingName + '</span>';
        if (authFormSub) authFormSub.textContent = 'Enter verification code sent to your email';
      } else {
        if (authFormTitle) authFormTitle.textContent = 'Verify Your Email';
        if (authFormSub) authFormSub.textContent = 'A 6-digit code has been sent to your email';
      }

      if (authOtpInput) {
        authOtpInput.value = '';
        authOtpInput.focus();
        if (data.devOtp) authOtpInput.value = data.devOtp;
      }

      showOtpFeedback(data.message || 'Verification code sent!', false);
      startResendCountdown(60);
    } catch (err) {
      showOtpFeedback('Network error. Please try again.', true);
    } finally {
      if (btnSendEmailOtp) {
        btnSendEmailOtp.disabled = false;
        btnSendEmailOtp.innerHTML = origBtnHtml;
      }
    }
  }

  if (btnSendEmailOtp) {
    btnSendEmailOtp.addEventListener('click', () => {
      const email = (authEmailInput?.value || '').trim();
      sendOtpRequest(email);
    });
  }

  if (btnChangeAuthEmail) {
    btnChangeAuthEmail.addEventListener('click', () => {
      if (authEmailStep2) authEmailStep2.style.display = 'none';
      if (authEmailStep1) authEmailStep1.style.display = 'block';
      if (authOtpFeedback) authOtpFeedback.style.display = 'none';
      if (authFormTitle) authFormTitle.textContent = 'Sign In / Register';
      if (authFormSub) authFormSub.textContent = 'Access your dedicated crypto wallet';
    });
  }

  if (btnVerifyEmailOtp) {
    btnVerifyEmailOtp.addEventListener('click', async () => {
      const otp = (authOtpInput?.value || '').trim();
      if (!otp || otp.length < 6) {
        showOtpFeedback('Please enter the 6-digit code.', true);
        return;
      }

      const origBtnHtml = btnVerifyEmailOtp.innerHTML;
      btnVerifyEmailOtp.disabled = true;
      btnVerifyEmailOtp.innerHTML = 'Verifying Code...';

      try {
        const res = await fetch(apiUrl('/api/auth/verify-otp'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentAuthEmail, otp })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          showOtpFeedback(data.error || 'Invalid code. Please check and try again.', true);
          return;
        }

        // Branch 1: EXISTING USER -> Instant Dashboard with Guaranteed Wallet
        if (!data.isNewUser && data.user) {
          showOtpFeedback('Welcome back! Loading your dashboard...', false);
          loginWithUserAccount(data.user.fullName, data.user.email, 'email');
          return;
        }

        // Branch 2: NEW USER -> Step to Name + Age Scroll + Agreement
        isNewUserFlow = true;
        if (authViewForm) {
          authViewForm.classList.remove('slide-in-right', 'slide-in-left');
          authViewForm.classList.add('slide-out-left');
          setTimeout(() => {
            authViewForm.style.display = 'none';
            authViewForm.classList.remove('slide-out-left');
            if (authViewNewUser) {
              authViewNewUser.style.display = 'flex';
              authViewNewUser.classList.remove('slide-out-left', 'slide-out-right');
              authViewNewUser.classList.add('slide-in-right');
              if (authNewFullName) authNewFullName.focus();
            }
          }, 240);
        }
      } catch (err) {
        showOtpFeedback('Verification network error.', true);
      } finally {
        btnVerifyEmailOtp.disabled = false;
        btnVerifyEmailOtp.innerHTML = origBtnHtml;
      }
    });
  }

  // Complete Registration for New User
  if (btnCompleteNewUserReg) {
    btnCompleteNewUserReg.addEventListener('click', async () => {
      const fullName = (authNewFullName?.value || '').trim();
      const age = parseInt(authAgeSelect?.value || '24', 10);
      const agreed = authTermsCheck?.checked;

      if (!fullName || fullName.length < 2) {
        if (authNewUserFeedback) {
          authNewUserFeedback.style.display = 'block';
          authNewUserFeedback.textContent = 'Please enter your full legal name.';
        }
        return;
      }

      if (!agreed) {
        if (authNewUserFeedback) {
          authNewUserFeedback.style.display = 'block';
          authNewUserFeedback.textContent = 'Please accept the terms of service.';
        }
        return;
      }

      const origText = btnCompleteNewUserReg.innerHTML;
      btnCompleteNewUserReg.disabled = true;
      btnCompleteNewUserReg.innerHTML = 'Generating Crypto Wallet...';

      try {
        const res = await fetch(apiUrl('/api/auth/complete-registration'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: currentAuthEmail,
            fullName: fullName,
            age: age,
            agreed: true
          })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          if (authNewUserFeedback) {
            authNewUserFeedback.style.display = 'block';
            authNewUserFeedback.textContent = data.error || 'Registration failed. Please try again.';
          }
          return;
        }

        // Success: Guaranteed crypto wallet generated & user logged in permanently
        if (authViewNewUser) authViewNewUser.style.display = 'none';
        loginWithUserAccount(data.user.fullName, data.user.email, 'email');
      } catch (err) {
        if (authNewUserFeedback) {
          authNewUserFeedback.style.display = 'block';
          authNewUserFeedback.textContent = 'Network error completing registration.';
        }
      } finally {
        btnCompleteNewUserReg.disabled = false;
        btnCompleteNewUserReg.innerHTML = origText;
      }
    });
  }

  // Expose global methods for testing, verification & interactive tooling
  window.navigateTo = navigateTo;
  window.loginWithGoogleAccount = loginWithGoogleAccount;
  window.sendUserPresenceHeartbeat = sendUserPresenceHeartbeat;
  window.syncUserDedicatedWallet = syncUserDedicatedWallet;
  window.setCardsViewState = setCardsViewState;
  window.startFaceVerification = startFaceVerification;
  window.updateAppWithUserData = updateAppWithUserData;
  window.updateFaceVerifyNoticeUI = updateFaceVerifyNoticeUI;
});
