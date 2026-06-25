document.addEventListener("DOMContentLoaded", function() {
            // FIX: Only allows authentication using this strict array registry data
            const staffRegistry = [
                { user: "owner1", pass: "Owner#1" },
                { user: "owner2", pass: "Owner#2" },
                { user: "cashier1", pass: "Cashier#1" },
                { user: "cashier2", pass: "Cashier#2" },
                { user: "cashier3", pass: "Cashier#3" }
            ];

            const loginBtn = document.getElementById("login-submit-trigger");
            const logoutBtn = document.getElementById("logout-trigger");
            const usernameInput = document.getElementById("login-user");
            const passwordInput = document.getElementById("login-pass");
            const errorContainer = document.getElementById("login-error");
            
            const dashboardSection = document.getElementById("dashboard-section");
            const loginSection = document.getElementById("login-section");
            const activeUserSpan = document.getElementById("active-staff-user");

            // Redirection Search variables
            const searchBtn = document.getElementById("search-submit-trigger");
            const searchNameInput = document.getElementById("search-name");
            const searchCategorySelect = document.getElementById("search-category");
            const productCards = document.querySelectorAll(".product-card");
            const categoryGroups = document.querySelectorAll(".category-group");

            // Authentication verification function
            if (loginBtn) {
                loginBtn.addEventListener("click", function() {
                    const inputUser = usernameInput.value.trim();
                    const inputPass = passwordInput.value;

                    errorContainer.style.display = "none";
                    errorContainer.textContent = "";

                    if (!inputUser || !inputPass) {
                        errorContainer.textContent = "Please fill in all identity parameters.";
                        errorContainer.style.display = "block";
                        return;
                    }

                    const authenticatedProfile = staffRegistry.find(account => account.user === inputUser && account.pass === inputPass);

                    if (authenticatedProfile) {
                        activeUserSpan.textContent = authenticatedProfile.user;
                        dashboardSection.classList.remove("dashboard-hidden");
                        if (loginSection) loginSection.classList.add("dashboard-hidden");
                        
                        usernameInput.value = "";
                        passwordInput.value = "";
                        
                        dashboardSection.scrollIntoView({ behavior: 'smooth' });
                    } else {
                        errorContainer.textContent = "Invalid administrative credentials.";
                        errorContainer.style.display = "block";
                    }
                });
            }

            if (logoutBtn) {
                logoutBtn.addEventListener("click", function() {
                    window.location.href = "main-system.html";
                });
            }

            // FIX: Search routing query engine logic for redirecting view onto products element module list
            searchBtn.addEventListener("click", function() {
                const queryText = searchNameInput.value.trim().toLowerCase();
                const selectedCategory = searchCategorySelect.value;

                // Reset all components to initial display values
                productCards.forEach(card => card.style.display = "flex");
                categoryGroups.forEach(group => group.style.display = "block");

                let hasMatches = false;
                let targetScrollElement = document.getElementById("products-section");

                // Execute parameters matching conditions filters
                categoryGroups.forEach(group => {
                    const groupCategory = group.getAttribute("data-category");
                    const cardsInGroup = group.querySelectorAll(".product-card");
                    let groupHasMatch = false;

                    // Filter based on select element filter settings logic
                    if (selectedCategory && groupCategory !== selectedCategory) {
                        group.style.display = "none";
                        return;
                    }

                    cardsInGroup.forEach(card => {
                        const productName = card.getAttribute("data-name") || "";
                        if (queryText === "" || productName.includes(queryText)) {
                            card.style.display = "flex";
                            groupHasMatch = true;
                            hasMatches = true;
                            // Set initial matching group container item element reference destination location context
                            if (targetScrollElement === document.getElementById("products-section")) {
                                targetScrollElement = group;
                            }
                        } else {
                            card.style.display = "none";
                        }
                    });

                    // Hide full block sets when interior children lists items metrics remain zero empty inside scope counters
                    if (!groupHasMatch && selectedCategory === "") {
                        group.style.display = "none";
                    }
                });

                // Smoothly route viewport coordinates directly onto filtered lists records interface row elements grid display structure
                targetScrollElement.scrollIntoView({ behavior: "smooth" });
            });
        });