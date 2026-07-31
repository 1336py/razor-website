fetch("/navbar.html")
    .then(response => response.text())
    .then(data => {
        document.getElementById("navbar").innerHTML = data;

        // wait until navbar exists
        setTimeout(() => {
            const navbar = document.querySelector(".topbar");

            if (navbar) {
                navbar.classList.add("loaded");
            }
        }, 50);
    });