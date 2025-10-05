
    // --- LOGIQUE DE L'APPLICATION ---
        const App = {
            state: {
                favorites: [],
                currentFilter: {},
                currentSort: 'default',
                currentCarId: null,
                orderData: {},
                currentOrderStep: 1,
            },

            init() {
                this.loadState();
                this.router();
                this.attachEventListeners();
                window.addEventListener('hashchange', this.router.bind(this));
                this.updateFavoritesCount();
            },
            
            async callGeminiAPI(prompt, isJson = false, retries = 3, delay = 1000) {
                const apiKey = "AIzaSyCQ_FzPsoDakD13QBnMgEtoPrnV2nbEjIA"; 
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
                
                const payload = { contents: [{ parts: [{ text: prompt }] }] };

                if (isJson) {
                    payload.generationConfig = {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "OBJECT",
                            properties: {
                                performance: { type: "STRING" },
                                comfort: { type: "STRING" },
                                value: { type: "STRING" },
                            },
                        },
                    };
                }
                
                for (let i = 0; i < retries; i++) {
                    try {
                        const response = await fetch(apiUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });

                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        
                        const result = await response.json();
                        const candidate = result.candidates?.[0];

                        if (candidate && candidate.content?.parts?.[0]?.text) {
                            return candidate.content.parts[0].text;
                        } else {
                             throw new Error("Réponse de l'API invalide.");
                        }
                    } catch (error) {
                        console.error(`Tentative ${i + 1} échouée:`, error);
                        if (i < retries - 1) {
                            await new Promise(res => setTimeout(res, delay));
                            delay *= 2;
                        } else {
                            return isJson ? null : "Désolé, l'assistant IA est actuellement indisponible.";
                        }
                    }
                }
            },

            async callGeminiVisionAPI(prompt, base64ImageData, retries = 3, delay = 1000) {
                const apiKey = "";
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

                const payload = {
                    contents: [{
                        parts: [
                            { text: prompt },
                            { inlineData: { mimeType: "image/jpeg", data: base64ImageData } }
                        ]
                    }]
                };

                for (let i = 0; i < retries; i++) {
                    try {
                        const response = await fetch(apiUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        const result = await response.json();
                        const candidate = result.candidates?.[0];
                        if (candidate && candidate.content?.parts?.[0]?.text) {
                            return candidate.content.parts[0].text;
                        } else {
                            throw new Error("Réponse de l'API Vision invalide.");
                        }
                    } catch (error) {
                        console.error(`Tentative Vision ${i + 1} échouée:`, error);
                        if (i < retries - 1) {
                            await new Promise(res => setTimeout(res, delay));
                            delay *= 2;
                        } else {
                            return null;
                        }
                    }
                }
            },

            loadState() {
                const savedTheme = localStorage.getItem('theme');
                if (savedTheme) document.body.classList.toggle('dark-theme', savedTheme === 'dark');
                
                const savedFavorites = localStorage.getItem('favorites');
                if (savedFavorites && savedFavorites !== 'undefined') {
                    try { this.state.favorites = JSON.parse(savedFavorites); } catch (e) { console.error("Could not parse favorites:", e); }
                }
                
                const savedCars = localStorage.getItem('carsDB');
                 if (savedCars && savedCars !== 'undefined') {
                    try { window.carsDB = JSON.parse(savedCars); } catch (e) { console.error("Could not parse carsDB:", e); }
                }
            },
            saveState() {
                localStorage.setItem('favorites', JSON.stringify(this.state.favorites));
                localStorage.setItem('carsDB', JSON.stringify(window.carsDB));
            },

            router() {
                const hash = window.location.hash || '#home';
                const [path, query] = hash.split('?');
                
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

                const params = new URLSearchParams(query);

                switch (true) {
                    case path.startsWith('#details/'):
                        this.state.currentCarId = parseInt(path.split('/')[1]);
                        document.getElementById('details-view').classList.add('active');
                        this.renderCarDetails(this.state.currentCarId);
                        break;
                    case path.startsWith('#order/'):
                        this.state.currentCarId = parseInt(path.split('/')[1]);
                        document.getElementById('order-view').classList.add('active');
                        this.renderOrderPage(this.state.currentCarId);
                        break;
                    case path === '#confirmation':
                         document.getElementById('confirmation-view').classList.add('active');
                         this.renderConfirmationPage();
                         break;
                    case path === '#listings':
                        document.getElementById('listings-view').classList.add('active');
                        this.renderListingsPage(params);
                        break;
                    default:
                        document.getElementById('home-view').classList.add('active');
                        this.renderHomePage();
                        break;
                }
                window.scrollTo(0, 0);
            },

            attachEventListeners() {
                document.getElementById('theme-switcher').addEventListener('click', () => {
                    document.body.classList.toggle('dark-theme');
                    localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
                });

                document.getElementById('filter-form').addEventListener('input', this.handleFiltering.bind(this));
                document.getElementById('sort-by').addEventListener('change', this.handleSorting.bind(this));

                document.body.addEventListener('click', e => {
                    const favoriteBtn = e.target.closest('.favorite-btn');
                    if (favoriteBtn) {
                        e.preventDefault();
                        e.stopPropagation();
                        const carId = parseInt(favoriteBtn.dataset.id);
                        this.toggleFavorite(carId);
                        this.rerenderCurrentCard(favoriteBtn.closest('.car-card'), carId);
                    }

                    const orderBtn = e.target.closest('#order-btn');
                    if (orderBtn) {
                        e.preventDefault();
                        window.location.hash = `#order/${this.state.currentCarId}`;
                    }
                });
                
                document.getElementById('generate-description-btn').addEventListener('click', this.handleGenerateDescription.bind(this));
                document.getElementById('compare-btn').addEventListener('click', this.handleCarComparison.bind(this));

                document.getElementById('image-upload-btn').addEventListener('click', () => {
                     document.getElementById('image-upload-input').click();
                });
                document.getElementById('image-upload-input').addEventListener('change', this.handleImageUpload.bind(this));

                // Order form navigation
                document.getElementById('next-btn').addEventListener('click', this.handleNextStep.bind(this));
                document.getElementById('prev-btn').addEventListener('click', this.handlePrevStep.bind(this));
                document.getElementById('order-form').addEventListener('submit', this.handleOrderSubmission.bind(this));

            },

            renderHomePage() {
                // Featured cars
                const featuredGrid = document.getElementById('featured-grid');
                const featuredCars = carsDB.filter(c => c.featured && c.status === 'available').slice(0, 4);
                featuredGrid.innerHTML = featuredCars.map(c => this.createCarCard(c)).join('');

                // All available cars (sample)
                const allCarsGrid = document.getElementById('all-cars-grid');
                // Get IDs of featured cars to exclude them
                const featuredCarIds = featuredCars.map(c => c.id);
                const availableCars = carsDB.filter(c => c.status === 'available' && !featuredCarIds.includes(c.id)).slice(0, 6);
                allCarsGrid.innerHTML = availableCars.map(c => this.createCarCard(c)).join('');

                this.renderCarOfTheDay();
            },

            renderListingsPage(params) {
                this.populateFilters();
                const showFavorites = params.get('favorites') === 'true';
                const searchQuery = params.get('search');

                const titleEl = document.getElementById('listings-title');
                let carsToShow = carsDB;
                
                document.getElementById('search-input').value = searchQuery || '';
                
                if (showFavorites) {
                    titleEl.textContent = 'Mes Favoris';
                    carsToShow = carsDB.filter(c => this.state.favorites.includes(c.id));
                    document.querySelector('.filters').style.display = 'none';
                    document.getElementById('sorting-options').style.display = 'none';
                } else {
                    titleEl.textContent = 'Nos Annonces';
                    document.querySelector('.filters').style.display = 'block';
                    document.getElementById('sorting-options').style.display = 'flex';
                }

                this.applyFiltersAndSort(carsToShow);
            },

            renderCarDetails(id) {
                const car = carsDB.find(c => c.id === id);
                if (!car) return;

                document.getElementById('car-title').textContent = `${car.make} ${car.model}`;
                document.getElementById('car-price').textContent = `${car.price.toLocaleString('fr-FR')} €`;
                document.getElementById('car-description').textContent = car.description;
                document.getElementById('main-car-image').src = car.images[0];
                
                document.getElementById('spec-sheet-list').innerHTML = `
                    <li><span>Année</span><span>${car.year}</span></li>
                    <li><span>Kilométrage</span><span>${car.mileage.toLocaleString('fr-FR')} km</span></li>
                    <li><span>Carburant</span><span>${car.fuelType}</span></li>
                    <li><span>Transmission</span><span>${car.transmission}</span></li>
                `;
                
                document.getElementById('comparison-output').innerHTML = '';
                document.getElementById('comparison-input').value = '';

                const orderBtn = document.getElementById('order-btn');
                if (car.status === 'sold') {
                    orderBtn.textContent = 'Véhicule Vendu';
                    orderBtn.disabled = true;
                } else {
                    orderBtn.textContent = 'Commander ce véhicule';
                    orderBtn.disabled = false;
                }


                this.setupImageGallery(car.images);
            },

            createCarCard(car) {
                const isFavorite = this.state.favorites.includes(car.id);
                return `
                    <div class="car-card">
                         ${car.status === 'sold' ? '<div class="sold-badge">Vendu</div>' : ''}
                         <div class="card-actions">
                            <button class="favorite-btn ${isFavorite ? 'active' : ''}" data-id="${car.id}" aria-label="Ajouter aux favoris">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                            </button>
                        </div>
                        <a href="#details/${car.id}" class="car-card-image-link">
                            <img src="${car.images[0]}" alt="${car.make} ${car.model}" loading="lazy">
                        </a>
                        <div class="car-card-content">
                            <h3><a href="#details/${car.id}">${car.make} ${car.model}</a></h3>
                            <p class="price">${car.price.toLocaleString('fr-FR')} €</p>
                            <ul class="details-list">
                                <li>${car.year}</li>
                                <li>${car.mileage.toLocaleString('fr-FR')} km</li>
                                <li>${car.fuelType}</li>
                            </ul>
                        </div>
                    </div>`;
            },
            
            rerenderCurrentCard(cardElement, carId) {
                if(!cardElement) return;
                const carData = carsDB.find(c => c.id === carId);
                if (carData) cardElement.outerHTML = this.createCarCard(carData);
            },

            populateFilters() {
                const makeFilter = document.getElementById('make-filter');
                if (makeFilter.options.length > 1) return;
                const makes = ['Toutes', ...new Set(carsDB.map(c => c.make).sort())];
                makeFilter.innerHTML = makes.map(m => `<option value="${m === 'Toutes' ? '' : m}">${m}</option>`).join('');
            },

            handleFiltering() {
                this.state.currentFilter = {
                    search: document.getElementById('search-input').value.toLowerCase(),
                    make: document.getElementById('make-filter').value,
                    minPrice: parseInt(document.getElementById('min-price-filter').value) || 0,
                    maxPrice: parseInt(document.getElementById('max-price-filter').value) || Infinity,
                    minYear: parseInt(document.getElementById('min-year-filter').value) || 0
                };
                this.applyFiltersAndSort(carsDB);
            },
            
            handleSorting(e) {
                this.state.currentSort = e.target.value;
                this.applyFiltersAndSort(carsDB);
            },

            applyFiltersAndSort(carList) {
                let cars = [...carList];
                const f = this.state.currentFilter;
                
                if(window.location.hash.startsWith('#listings') && !window.location.hash.includes('favorites')){
                     cars = cars.filter(c => 
                        (!f.search || c.model.toLowerCase().includes(f.search) || c.make.toLowerCase().includes(f.search)) &&
                        (!f.make || c.make === f.make) &&
                        (c.price >= f.minPrice) &&
                        (c.price <= f.maxPrice) &&
                        (c.year >= f.minYear)
                    );
                }

                switch(this.state.currentSort) {
                    case 'price-asc': cars.sort((a,b) => a.price - b.price); break;
                    case 'price-desc': cars.sort((a,b) => b.price - a.price); break;
                    case 'year-desc': cars.sort((a,b) => b.year - a.year); break;
                    case 'year-asc': cars.sort((a,b) => a.year - b.year); break;
                }

                this.displayCars(cars);
            },

            displayCars(cars) {
                const grid = document.getElementById('listings-grid');
                grid.innerHTML = cars.length > 0
                    ? cars.map(c => this.createCarCard(c)).join('')
                    : '<p>Aucun véhicule ne correspond à vos critères.</p>';
            },

            toggleFavorite(id) {
                const index = this.state.favorites.indexOf(id);
                if (index > -1) this.state.favorites.splice(index, 1);
                else this.state.favorites.push(id);
                
                this.saveState();
                this.updateFavoritesCount();
                
                if (window.location.hash.includes('favorites=true')) {
                    this.renderListingsPage(new URLSearchParams('favorites=true'));
                }
            },

            updateFavoritesCount() {
                document.getElementById('favorites-count').textContent = this.state.favorites.length;
            },
            
            async renderCarOfTheDay() {
                const section = document.getElementById('car-of-the-day-section');
                const availableCars = carsDB.filter(c => c.status === 'available');
                if (availableCars.length === 0) {
                    section.innerHTML = `<h2 class="section-title">Voiture du Jour</h2><p>Tous nos véhicules ont été vendus !</p>`;
                    return;
                };

                const today = new Date().getDate();
                const car = availableCars[today % availableCars.length];
                
                section.innerHTML = `<h2 class="section-title">Voiture du Jour</h2><div class="loader"></div>`;
                section.querySelector('.loader').style.display = 'block';

                const prompt = `Rédige une accroche marketing courte et percutante (2 phrases maximum) pour mettre en avant la ${car.make} ${car.model} de ${car.year} comme "Voiture du Jour".`;
                const highlight = await this.callGeminiAPI(prompt);

                section.innerHTML = `
                    <h2 class="section-title">Voiture du Jour</h2>
                    <div id="car-of-the-day-content">
                        <img src="${car.images[0]}" alt="${car.make} ${car.model}">
                        <div>
                            <h3><a href="#details/${car.id}">${car.make} ${car.model}</a></h3>
                            <p>${highlight}</p>
                            <br>
                            <a href="#details/${car.id}" class="btn">Découvrir</a>
                        </div>
                    </div>
                `;
            },

            async handleGenerateDescription() {
                const car = carsDB.find(c => c.id === this.state.currentCarId);
                if (!car) return;
                
                const btn = document.getElementById('generate-description-btn');
                const loader = document.getElementById('description-loader');
                const descriptionEl = document.getElementById('car-description');

                btn.disabled = true;
                loader.style.display = 'inline-block';
                
                const prompt = `Rédige une description marketing percutante et attrayante pour une ${car.make} ${car.model} de ${car.year}. La description doit faire 3 à 4 phrases et être engageante, en un seul paragraphe.`;
                descriptionEl.textContent = await this.callGeminiAPI(prompt);
                
                btn.disabled = false;
                loader.style.display = 'none';
            },

            async handleCarComparison() {
                const car = carsDB.find(c => c.id === this.state.currentCarId);
                if (!car) return;
                
                const modelToCompare = document.getElementById('comparison-input').value.trim();
                if (!modelToCompare) return;
                
                const btn = document.getElementById('compare-btn');
                const loader = document.getElementById('comparison-loader');
                const outputEl = document.getElementById('comparison-output');

                btn.disabled = true;
                loader.style.display = 'block';
                outputEl.innerHTML = '';

                const prompt = `Compare la ${car.make} ${car.model} avec la ${modelToCompare}. Fournis une comparaison sur les aspects 'performance', 'confort', et 'value' (rapport qualité/prix).`;
                
                const comparisonJson = await this.callGeminiAPI(prompt, true);
                
                if(comparisonJson) {
                    try {
                        const data = JSON.parse(comparisonJson);
                        outputEl.innerHTML = `
                            <table>
                                <tr><th>Critère</th><th>Analyse de l'IA</th></tr>
                                <tr><td><strong>Performance</strong></td><td>${data.performance}</td></tr>
                                <tr><td><strong>Confort</strong></td><td>${data.comfort}</td></tr>
                                <tr><td><strong>Rapport Q/P</strong></td><td>${data.value}</td></tr>
                            </table>
                        `;
                    } catch(e) {
                        outputEl.textContent = "Erreur lors de l'analyse de la comparaison.";
                    }
                } else {
                     outputEl.textContent = "La comparaison a échoué. Veuillez réessayer.";
                }

                btn.disabled = false;
                loader.style.display = 'none';
            },

            async handleImageUpload(event) {
                const file = event.target.files[0];
                if (!file) return;

                const loader = document.getElementById('image-search-loader');
                const resultEl = document.getElementById('image-search-result');
                const previewContainer = document.getElementById('image-preview-container');
                
                loader.style.display = 'block';
                resultEl.textContent = "Analyse de l'image...";
                previewContainer.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="Aperçu">`;

                const reader = new FileReader();
                reader.onloadend = async () => {
                    const base64Data = reader.result.split(',')[1];
                    const prompt = "Identifie la marque et le modèle de la voiture dans cette image. Réponds uniquement avec la marque et le modèle. Exemple: 'Toyota Camry'";
                    const carName = await this.callGeminiVisionAPI(prompt, base64Data);

                    loader.style.display = 'none';
                    if (carName) {
                        resultEl.textContent = `Modèle identifié : ${carName}. Redirection vers les résultats...`;
                        const model = carName.split(' ')[1];
                        setTimeout(() => {
                            window.location.hash = `#listings?search=${model}`;
                        }, 2000);
                    } else {
                        resultEl.textContent = "Impossible d'identifier le véhicule. Essayez une autre image.";
                    }
                };
                reader.readAsDataURL(file);
            },
            
            // --- NOUVELLES FONCTIONS DE COMMANDE ---
            renderOrderPage(id) {
                const car = carsDB.find(c => c.id === id);
                if (!car || car.status === 'sold') {
                    window.location.hash = '#listings';
                    return;
                }
                
                this.state.orderData = { car };
                this.state.currentOrderStep = 1;

                document.getElementById('order-summary').innerHTML = `
                    <div class="order-summary-item">
                        <img src="${car.images[0]}" alt="${car.make} ${car.model}">
                        <div>
                            <h3>${car.make} ${car.model} (${car.year})</h3>
                            <p class="price">${car.price.toLocaleString('fr-FR')} €</p>
                        </div>
                    </div>
                `;
                this.updateOrderFormStep();
            },

            handleNextStep() {
                if (this.validateStep()) {
                    if (this.state.currentOrderStep < 4) {
                        this.state.currentOrderStep++;
                        this.updateOrderFormStep();
                    }
                }
            },

            handlePrevStep() {
                if (this.state.currentOrderStep > 1) {
                    this.state.currentOrderStep--;
                    this.updateOrderFormStep();
                }
            },

            validateStep() {
                if(this.state.currentOrderStep === 2) {
                    const name = document.getElementById('fullName').value.trim();
                    const email = document.getElementById('email').value.trim();
                    const phone = document.getElementById('phone').value.trim();
                    if(!name || !email || !phone) {
                        alert('Veuillez remplir tous les champs.');
                        return false;
                    }
                }
                return true;
            },

            updateOrderFormStep() {
                const steps = document.querySelectorAll('.form-step');
                steps.forEach(step => step.classList.remove('active'));
                document.querySelector(`.form-step[data-step="${this.state.currentOrderStep}"]`).classList.add('active');

                const progressSteps = document.querySelectorAll('.progress-step');
                progressSteps.forEach(step => {
                    step.classList.toggle('active', parseInt(step.dataset.step) <= this.state.currentOrderStep);
                });

                document.querySelector('.progress-bar-line').style.width = `${((this.state.currentOrderStep - 1) / 3) * 100}%`;

                document.getElementById('prev-btn').style.display = this.state.currentOrderStep > 1 ? 'inline-block' : 'none';
                document.getElementById('next-btn').style.display = this.state.currentOrderStep < 4 ? 'inline-block' : 'none';
                document.getElementById('submit-btn').style.display = this.state.currentOrderStep === 4 ? 'inline-block' : 'none';

                if(this.state.currentOrderStep === 4) {
                    this.state.orderData.customer = {
                        name: document.getElementById('fullName').value,
                        email: document.getElementById('email').value,
                        phone: document.getElementById('phone').value,
                    };
                    this.state.orderData.payment = document.querySelector('input[name="payment"]:checked').value;

                    document.getElementById('final-summary').innerHTML = `
                        <p><strong>Véhicule:</strong> ${this.state.orderData.car.make} ${this.state.orderData.car.model}</p>
                        <p><strong>Nom:</strong> ${this.state.orderData.customer.name}</p>
                        <p><strong>Paiement:</strong> ${this.state.orderData.payment === 'cash' ? 'Paiement comptant' : 'Demande de financement'}</p>
                    `;
                }
            },

            handleOrderSubmission(e) {
                e.preventDefault();
                console.log('Commande soumise :', this.state.orderData);

                // Mark car as sold
                const carIndex = carsDB.findIndex(c => c.id === this.state.orderData.car.id);
                if (carIndex !== -1) {
                    carsDB[carIndex].status = 'sold';
                }
                
                localStorage.setItem('lastOrder', JSON.stringify(this.state.orderData));
                this.saveState();
                window.location.hash = '#confirmation';
            },
            
            async renderConfirmationPage() {
                const lastOrder = JSON.parse(localStorage.getItem('lastOrder'));
                if(!lastOrder) return;

                const loader = document.getElementById('confirmation-loader');
                const nextStepsEl = document.getElementById('next-steps-ai');
                
                loader.style.display = 'block';
                nextStepsEl.innerHTML = '';

                const paymentMethodText = lastOrder.payment === 'cash' ? 'un paiement comptant' : 'une demande de financement';
                const prompt = `Le client ${lastOrder.customer.name} vient de commander une ${lastOrder.car.make} ${lastOrder.car.model} avec ${paymentMethodText}. Rédige un court paragraphe (3 phrases) décrivant les prochaines étapes de manière rassurante et professionnelle. Mentionne qu'un conseiller va le contacter.`;

                const nextSteps = await this.callGeminiAPI(prompt);
                
                loader.style.display = 'none';
                nextStepsEl.textContent = nextSteps;
            },


            setupImageGallery(images) {
                const mainImage = document.getElementById('main-car-image');
                const thumbnails = document.getElementById('thumbnails-container');
                thumbnails.innerHTML = images.map((img, index) => 
                    `<img src="${img}" alt="Vignette ${index+1}" class="${index === 0 ? 'active' : ''}" data-index="${index}">`
                ).join('');

                thumbnails.addEventListener('click', e => {
                    if (e.target.tagName === 'IMG') {
                        mainImage.src = e.target.src;
                        thumbnails.querySelectorAll('img').forEach(i => i.classList.remove('active'));
                        e.target.classList.add('active');
                    }
                });
                
                const modal = document.getElementById('image-modal');
                const modalImg = document.getElementById('modal-image');
                let currentIndex = 0;
                
                mainImage.onclick = () => {
                    currentIndex = Array.from(thumbnails.querySelectorAll('img')).findIndex(img => img.classList.contains('active'));
                    modalImg.src = images[currentIndex];
                    modal.classList.add('show');
                }
                
                modal.querySelector('.modal-close').onclick = () => modal.classList.remove('show');
                modal.querySelector('.modal-prev').onclick = () => {
                    currentIndex = (currentIndex - 1 + images.length) % images.length;
                    modalImg.src = images[currentIndex];
                };
                modal.querySelector('.modal-next').onclick = () => {
                    currentIndex = (currentIndex + 1) % images.length;
                    modalImg.src = images[currentIndex];
                };
            },
        };

        document.addEventListener('DOMContentLoaded', () => App.init());