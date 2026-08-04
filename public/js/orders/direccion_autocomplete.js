const input = document.getElementById("direccion");
const resultadosDiv = document.getElementById("resultados");

let autocomplete = null;
let googleActivo = false;
let debounceTimer;
let ultimoTexto = "";
let ultimoResultado = [];
let ultimaBusquedaId = 0;
let sessionToken = null;
let ultimaCalle = "";


input.addEventListener("input", function () {

    delete input.dataset.lat;
    delete input.dataset.lng;
    delete input.dataset.place_id;
    delete input.dataset.street_address;
    delete input.dataset.city;
    delete input.dataset.state;
    delete input.dataset.country;    

    clearTimeout(debounceTimer);

    debounceTimer = setTimeout(() => {
        manejarBusqueda();
    }, 300);
});

input.addEventListener("blur", function () {
    setTimeout(() => {
        resultadosDiv.innerHTML = "";
    }, 200);
});

async function manejarBusqueda() {

    const texto = input.value.trim();
    
    // reutilizar última calle usada
    if (ultimaCalle && /^\d/.test(texto)) {
        input.value = ultimaCalle + " " + texto;
    }    
    
    if (!sessionToken) {
        sessionToken = new google.maps.places.AutocompleteSessionToken();
    }    

    if (texto.length < 3) {
        resultadosDiv.innerHTML = "";
        return;
    }
    
    const busquedaId = ++ultimaBusquedaId;
    
    const tenantId = document.getElementById("tenant_id").value;
    const customerId = document.getElementById("customer_id").value;
    
    if (!tenantId || !customerId) {
        resultadosDiv.innerHTML = "";
        return;
    }
    const resp = await fetch("/api/catalogs/customers/search_customer_addresses.php?tenant_id=" + tenantId + "&customer_id=" + customerId + "&q=" + texto)
    const data = await resp.json();
    
    
    if (busquedaId !== ultimaBusquedaId) return;
    
    ultimoTexto = texto;
    ultimoResultado = data;    

    const tieneNumero = /\d/.test(texto);

    if (data.length > 0 && tieneNumero) {
        
        const numeroIngresado = texto.match(/\d+/)?.[0] || "";
        
        const textoLower = texto.toLowerCase();
        const textoEscapado = textoLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        
        const regexCoincidenciaExacta = new RegExp(
            "^" + textoEscapado + "(?:$|[^a-z0-9áéíóúñ])",
            "i"
        );
        const existeCoincidenciaExacta = data.some(d =>
            regexCoincidenciaExacta.test(d.address.toLowerCase())
        );       

        resultadosDiv.innerHTML = "";
        googleActivo = false;

        data.forEach(d => {

            const numeroDireccion = d.address.match(/\d+/)?.[0] || "";
        
            if (numeroIngresado && numeroDireccion !== numeroIngresado) {
                return;
            }            

            const div = document.createElement("div");
            div.textContent = d.address;

            div.onclick = function () {

                input.value = d.address;
                ultimaCalle = d.address.split(",")[0];
                input.dataset.street_address = d.address.split(",")[0];

                input.dataset.lat = d.lat;
                input.dataset.lng = d.lng;
                input.dataset.place_id = d.place_id;
                input.dataset.city = d.city || "";
                input.dataset.state = d.state || "";
                input.dataset.country = d.country || "";

                resultadosDiv.innerHTML = "";
            };

            resultadosDiv.appendChild(div);

        });
        
        activarGoogle(texto);
       

    } else {
        resultadosDiv.innerHTML = "";
        if (!googleActivo) {
            activarGoogle(texto);
        }       
    }
}


function activarGoogle(texto) {

    if (!sessionToken) {
        sessionToken = new google.maps.places.AutocompleteSessionToken();
    }

    const service = new google.maps.places.AutocompleteService();

    service.getPlacePredictions({
        input: texto,
        componentRestrictions: { country: "ar" },
        sessionToken: sessionToken
    }, function(predictions, status) {

        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
            return;
        }
        
        const yaHayLocales = resultadosDiv.children.length > 0;
        
        if (yaHayLocales) {
            const separador = document.createElement("div");
            separador.style.marginTop = "8px";
            separador.style.paddingTop = "6px";
            separador.style.borderTop = "1px solid #ccc";
            separador.style.fontSize = "12px";
            separador.style.color = "#666";
            separador.textContent = "Google";
            resultadosDiv.appendChild(separador);
        } else {
            resultadosDiv.innerHTML = "";
        }
        
        const googleLabel = document.createElement("div");
        googleLabel.style.fontSize = "11px";
        googleLabel.style.color = "#777";
        googleLabel.style.marginTop = "4px";
        googleLabel.textContent = "powered by Google";

        predictions.forEach(p => {

            const div = document.createElement("div");
            div.textContent = p.description;

            div.onclick = function () {

                const placeService = new google.maps.places.PlacesService(document.createElement("div"));

                placeService.getDetails({
                    placeId: p.place_id,
                    fields: ["geometry","address_components","formatted_address","place_id"],
                    sessionToken: sessionToken
                }, function(place, status) {

                    if (status !== google.maps.places.PlacesServiceStatus.OK) return;

                    let route = "";
                    let street_number = "";
                    let city = "";
                    let state = "";
                    let country = "";

                    if (place.address_components) {

                        place.address_components.forEach(component => {

                            const types = component.types;
                            
                            if (types.includes("route")) {
                                route = component.long_name;
                            }                           
                            if (types.includes("street_number")) {
                                street_number = component.long_name;
                            }                           
                            if (types.includes("locality")) {
                                city = component.long_name;
                            }
                            if (types.includes("administrative_area_level_1")) {
                                state = component.long_name;
                            }
                            if (types.includes("country")) {
                                country = component.long_name;
                            }
                        });
                    }
                    
                    const street_address = (route + " " + street_number).trim();
                    input.value = place.formatted_address;

                    ultimaCalle = place.formatted_address.split(",")[0];

                    input.dataset.lat = place.geometry.location.lat();
                    input.dataset.lng = place.geometry.location.lng();
                    input.dataset.place_id = place.place_id;
                    
                    input.dataset.street_address = street_address;
                    input.dataset.city = city;
                    input.dataset.state = state;
                    input.dataset.country = country;
                    
                    resultadosDiv.innerHTML = "";

                    sessionToken = null;

                });
            };

            resultadosDiv.appendChild(div);

        });
        
        resultadosDiv.appendChild(googleLabel);

    });

}


function mostrarResultados(data) {

    resultadosDiv.innerHTML = "";

    data.forEach(d => {

        const div = document.createElement("div");
        div.textContent = d.address;

        div.onclick = function () {

            input.value = d.address;
            ultimaCalle = d.address.split(",")[0];
            input.dataset.street_address = d.address.split(",")[0];

            input.dataset.lat = d.lat;
            input.dataset.lng = d.lng;
            input.dataset.place_id = d.place_id;
            input.dataset.city = d.city || "";
            input.dataset.state = d.state || "";
            input.dataset.country = d.country || "";            

            resultadosDiv.innerHTML = "";
        };

        resultadosDiv.appendChild(div);

    });

}
