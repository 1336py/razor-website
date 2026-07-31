fetch("/navbar.html")
    .then(response => response.text())
    .then(data => {
        document.getElementById("navbar").innerHTML = data;

        // Wait until navbar exists
        setTimeout(() => {
            document.querySelector("#navbar .topbar").classList.add("loaded");
        }, 2000);
    });


window.addEventListener('load', function() {
    setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('hidden');
    }, 2000);
});