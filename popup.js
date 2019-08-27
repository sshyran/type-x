// Copyright 2019 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const activateFonts = document.querySelector("#activateFonts");
const showFonts = document.querySelector("#showFonts");
const addFont = document.querySelector("#addFont");
const showBlacklist = document.querySelector("#showBlacklist");
const fontFiles = {};
const localFonts = {};

// Get current fonts from storage and show them in the popup
chrome.fontSettings.getFontList((fonts) => {
    for (const font of fonts) {
        localFonts[font.displayName] = font.fontId;
    }
    chrome.storage.local.get(
        ["fonts", "files", "blacklist"], ({
            fonts,
            files,
            blacklist
        }) => {
            buildForm(fonts, files, blacklist);
        }
    );
});

// Toggle extension on/off using the button
activateFonts.onclick = () => {
    chrome.storage.local.get(
        "fontActivated", ({
            fontActivated
        }) => {
            updateStatus(!fontActivated);
        }
    );
};

// Show/hide font form
showFonts.onclick = () => {
    document.querySelector(".main-fonts").classList.toggle("show");
    document.querySelector("footer").classList.toggle("show");
    showFonts.classList.toggle("active");
}

// Show/hide blacklist
showBlacklist.onclick = () => {
    document.querySelector(".blacklist").classList.toggle("show");
}

// Add new font fieldset to form
addFont.onclick = () => {
    const randomId = window.crypto.getRandomValues(new Uint32Array(2)).join("");
    chrome.storage.local.get(
        "files", ({
            files
        }) => {
            const newFont = {
                "new": true,
                "id": randomId,
                "file": Object.keys(files)[0],
                "fallback": ["monospace"],
                "selectors": ["/* Add CSS selectors here */"],
                "css": "/* Additional styles to apply */"
            };

            addFormElement(newFont, files);
            showChange(true);
        }
    );
};

// Toggle extension on/off
function updateStatus(status, updateExisting) {
    chrome.storage.local.set({
        "fontActivated": status
    }, () => {
        chrome.runtime.getBackgroundPage(backgroundPage => {
            backgroundPage.updateFonts(status, updateExisting);
        });
        showStatus();
    });
}

// Show status of extension in the popup
const showStatus = (firstRun) => {
    chrome.storage.local.get(
        "fontActivated", ({
            fontActivated
        }) => {
            chrome.browserAction.setIcon({
                path: `icons/typex-${fontActivated ? "active" : "off"}@128.png`
            });
            activateFonts.classList.toggle("active", fontActivated);
            !firstRun && activateFonts.classList.remove("first-run");
        }
    );
}

// Show/hide button to apply changes
function showChange(show) {
    document.querySelector(".apply-changes").classList.toggle("show", show);
}

// Initialise form
function initForm() {
    document.querySelector(".apply-changes").onclick = () => {
        saveForm();
        showChange(false);
    }

    document.querySelector("#fontsForm").oninput = () => {
        showChange(true);
    }
}

// Generate form based on current settings
function buildForm(fonts, files, blacklist) {
    const form = document.querySelector("#fontsForm");
    const usedFonts = form.querySelector("#usedFonts");
    const blacklistEl = form.querySelector("[name=blacklist]");

    // Clear out previous form
    while (usedFonts.firstChild) {
        usedFonts.removeChild(usedFonts.firstChild);
    }

    // Inject new fonts
    for (const font of fonts) {
        addFormElement(font, files);
    }

    // Inject blacklist
    blacklistEl.value = blacklist.join(", ");
}

// New file uploaded, append to all selects
function updateFontDropdowns(id) {
    const optgroups = document.querySelectorAll(".select-font select optgroup:first-child");
    for (const optgroup of optgroups) {
        const options = optgroup.querySelectorAll("option");
        let present = false;
        for (const option of options) {
            present = option.value === id ? true : present;
        }
        if (present) {
            optgroup.value = id;
        } else {
            const option = document.createElement("option");
            option.value = id;
            option.text = id;
            optgroup.append(option);
        }
    }
}

// Add new font to the form
function addFormElement(font, files) {
    const usedFonts = document.querySelector("#usedFonts");
    const template = document.querySelector("#newFont");
    const el = document.importNode(template.content, true);
    const parentEl = el.querySelector(".font");

    el.querySelector(".font-name-title").innerText = font.file || "New font override";

    const fontSelect = el.querySelector(".select-font select");

    const dropdown = document.createElement("select");
    dropdown.setAttribute("name", "file");
    dropdown.setAttribute("id", `file${font.id}`);
    dropdown.onchange = (e) => {
        e.target.closest("fieldset").querySelector(".font-name-title").innerText = e.target.value;
    };

    const extensionGroup = document.createElement("optgroup");
    extensionGroup.setAttribute("label", "Custom fonts:");
    for (const id in files) {
        const option = document.createElement("option");
        option.value = id;
        option.text = id;
        option.selected = font.file == id;
        extensionGroup.append(option);
    }
    dropdown.append(extensionGroup);

    const localGroup = document.createElement("optgroup");
    localGroup.setAttribute("label", "Local fonts:");
    for (const id in localFonts) {
        const option = document.createElement("option");
        option.value = id;
        option.text = id;
        option.selected = font.file == id;
        localGroup.append(option);
    }
    dropdown.append(localGroup);

    fontSelect.replaceWith(dropdown);

    el.querySelector("[name=newfile]").onchange = grabFont;

    parentEl.dataset.fontid = font.id;
    el.querySelector("[name=id]").value = font.id;
    el.querySelector("[name=css]").value = font.css;
    el.querySelector("[name=fallback]").value = font.fallback;
    el.querySelector("[name=selectors]").value = font.selectors.join(", ");

    el.querySelector(".show-fallbacks").onclick = (e) => {
        e.target.closest("fieldset").classList.toggle("show-font-fallbacks");
    };

    el.querySelector(".delete-font").onclick = (e) => {
        e.target.closest("fieldset").remove();
        showChange(true);
    };

    el.querySelector(".font-title button").onclick = (e) => {
        e.target.closest("fieldset").classList.toggle("show-font-details");
    };

    if (font.new) {
        el.querySelector("fieldset").classList.add("show-font-details");
    }

    parentEl.addEventListener("dragover", highlight, false);
    parentEl.addEventListener("dragleave", unhighlight, false);
    parentEl.addEventListener("drop", grabFont, false);

    usedFonts.prepend(el);
}

// Store changes made to fonts
// Note: files have already been stored at this point
function saveForm() {
    const newFonts = [];
    const form = document.querySelector("#fontsForm");
    const fieldsets = form.querySelectorAll("fieldset");

    // Get new fonts
    for (const fieldset of fieldsets) {
        const newFont = {}
        const inputs = fieldset.querySelectorAll("*[name]");

        const straightInputs = ["id", "css", "file", "fallback"];

        for (const input of inputs) {
            if (straightInputs.includes(input.name)) {
                newFont[input.name] = input.value;
            } else if (input.name === "selectors") {
                // Selectors should become an array
                newFont["selectors"] = input.value.split(",").map(i => i.trim());
            }
        }
        newFonts.unshift(newFont);
    }

    // Get blacklist
    const blacklist = form.querySelector("[name=blacklist]").value.split(",").map(i => i.trim());

    // Apply new fonts and activate extension
    chrome.storage.local.set({
        "fonts": newFonts,
        "blacklist": blacklist
    }, () => {
        updateStatus(true, true);
    });
}

// Keep track of file data, and hook up to rest
// of form data on submit
function grabFont(e) {
    const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
    const file = files[0]; // Only use first file if multiple are dropped
    const name = file.name;
    const container = e.target.closest("fieldset");
    const fontId = container.dataset.fontid;

    container.classList.remove("highlight");

    // Check if filetype is allowed
    const allowedExt = ["ttf","otf","eot","woff","woff2"];
    const ext = name.split('.').pop().toLowerCase();
    if(!allowedExt.includes(ext)) {
        return false;
    }

    const reader = new FileReader();
    reader.onload = ({
        target
    }) => {
        // Stick new file in storage
        chrome.storage.local.get(
            "files", ({
                files
            }) => {
                files[name] = target.result;
                chrome.storage.local.set({
                    "files": files
                }, () => {
                    showChange(true);
                    updateFontDropdowns(name);
                    const dropdown = document.querySelector(`#file${fontId}`);
                    dropdown.value = name;
                    dropdown.dispatchEvent(new Event("change"));
                });
            }
        );
    };
    reader.readAsDataURL(file);
}

function highlight(e) {
    this.classList.add("highlight");
    e.preventDefault();
    e.stopPropagation();
}

function unhighlight(e) {
    this.classList.remove("highlight");
    e.preventDefault();
    e.stopPropagation();
}

function handleDrop(e) {
    const files = e.dataTransfer.files;
    // When dropping multiple files, only use the first one
    const file = files[0];
    console.log(files);
}

// Initialise popup
showStatus(true);
initForm();