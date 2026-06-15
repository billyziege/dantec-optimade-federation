import os
import tkinter as tk
from tkinter import ttk
from tkinter import messagebox
from .optimade_client import fetch_structures
from .raven_data_access import RavenDBClient

elements_list = ["H", "He",
                 "Li", "Be", "B", "C", "N", "O", "F", "Ne",
                 "Na", "Mg", "Al", "Si", "P", "S", "Cl", "Ar",
                 "K", "Ca",
                 "Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn",
                 "Ga", "Ge", "As", "Se", "Br", "Kr",
                 "Rb", "Sr", "Y", "Zr",
                 "Nb", "Mo", "Tc", "Ru", "Rh", "Pd", "Ag", "Cd",
                 "In", "Sn", "Sb", "Te", "I", "Xe",
                 "Cs", "Ba",
                 "La", "Ce", "Pr", "Nd", "Pm", "Sm", "Eu", "Gd",
                 "Tb", "Dy", "Ho", "Er", "Tm", "Yb", "Lu",
                 "Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au", "Hg",
                 "Tl", "Pb", "Bi", "Po", "At", "Rn",
                 "Fr", "Ra",
                 "Ac", "Th", "Pa", "U", "Np", "Pu", "Am", "Cm",
                 "Bk", "Cf", "Es", "Fm", "Md", "No", "Lr",
                 "Rf", "Db", "Sg", "Bh", "Hs", "Mt", "Ds", "Rg", "Cn",
                 "Nh", "Fl", "Mc", "Lv", "Ts", "Og"]

# Connect to the RavenDB
'''
We need to connect to the RavenDB and access to an specific database.
To do it one needs to download RavenDB from https://ravendb.net/download. It is straight forward.
Then in the folder you have unzipped the files run "run.ps1" with PowerShell. In Windows Right click and select.
The RavenDB studio opens and you can create a database i.e. "NomadToRaven"
'''
client = RavenDBClient(base_url="http://127.0.0.1:8080", database="NomadToRaven")

running_folder = os.getcwd()

# Store full records mapped to table rows
record_map = {}

# ----------------------------------------------------------------------------------------------------------------------
# TKINTER WINDOW
# ----------------------------------------------------------------------------------------------------------------------
window = tk.Tk()
window.title("Transfer NOMAD Material to RavenDB")
window.geometry("1200x300")

image_file = running_folder + os.sep + 'Icon.png'
window.iconphoto(False, tk.PhotoImage(file=image_file))

style = ttk.Style()
style.configure("Error.TEntry", fieldbackground="#ffcccc")

# ----------------------------------------------------------------------------------------------------------------------
# Basic functions
# ----------------------------------------------------------------------------------------------------------------------
def close_all():
    window.quit()


def rgb_color(r, g, b):
    return f"#{r:02x}{g:02x}{b:02x}"


# ----------------------------------------------------------------------------------------------------------------------
# SEARCH FUNCTION
# ----------------------------------------------------------------------------------------------------------------------
def search_materials():
    global record_map

    # clear table + map
    for row in table.get_children():
        table.delete(row)
    record_map = {}

    table.heading("Select", text="☐")

    element = element_var.get().strip()
    if not element:
        warning_label.config(text="⚠ Please select an element.")
        return
    else:
        warning_label.config(text="")

    try:
        page_size = int(number_var.get())
    except ValueError:
        page_size = 5

    records = fetch_structures(
        filter_str=f'elements HAS "{element}"',
        max_results=page_size,
    )

    for m in records:
        row_id = table.insert(
            "", "end",
            values=("☐", m["id"], m["date"], m["title"], ", ".join(m["elements"]), m["authors"])
        )
        record_map[row_id] = m  # store full dict


# ----------------------------------------------------------------------------------------------------------------------
# CHECKBOX HANDLING
# ----------------------------------------------------------------------------------------------------------------------
select_all_state = False


def toggle_checkbox(event):
    global select_all_state

    region = table.identify("region", event.x, event.y)

    # HEADER CLICK → SELECT ALL
    if region == "heading":
        column = table.identify_column(event.x)
        if column == "#1":
            select_all_state = not select_all_state
            new_value = "☑" if select_all_state else "☐"

            for row in table.get_children():
                values = list(table.item(row, "values"))
                values[0] = new_value
                table.item(row, values=values)

            table.heading("Select", text=new_value)
        return

    # CELL CLICK → SINGLE TOGGLE
    if region != "cell":
        return

    row_id = table.identify_row(event.y)
    column = table.identify_column(event.x)

    if column == "#1":
        values = list(table.item(row_id, "values"))
        values[0] = "☑" if values[0] == "☐" else "☐"
        table.item(row_id, values=values)


# ----------------------------------------------------------------------------------------------------------------------
# GET SELECTED RECORDS
# ----------------------------------------------------------------------------------------------------------------------
def get_selected_records():
    selected = []

    for row in table.get_children():
        values = table.item(row, "values")
        if values[0] == "☑":
            selected.append(record_map[row])  # return full dictionary

    return selected


# ----------------------------------------------------------------------------------------------------------------------
# EXPORT FUNCTION
# ----------------------------------------------------------------------------------------------------------------------
def export():
    selected = get_selected_records()

    if not selected:
        messagebox.showwarning("No selection", "No records selected.")
        return

    for record in selected:
        client.insert_single_document(data=record)


# ----------------------------------------------------------------------------------------------------------------------
# GUI
# ----------------------------------------------------------------------------------------------------------------------
top_frame = ttk.Frame(window)
top_frame.pack(pady=10)

warning_label = tk.Label(window, text="", fg="red")
warning_label.pack()

ttk.Label(top_frame, text="Element:").pack(side=tk.LEFT, padx=5)
element_var = tk.StringVar()
element_entry = ttk.Combobox(
    top_frame,
    textvariable=element_var,
    values=elements_list,
    width=12,
    state="readonly"
)
element_entry.pack(side=tk.LEFT, padx=5)

ttk.Label(top_frame, text="no. records:").pack(side=tk.LEFT, padx=10)
number_var = tk.StringVar()
number_of_entry = ttk.Combobox(
    top_frame,
    textvariable=number_var,
    values=['5', '10', '15', '20'],
    width=6,
    state="readonly"
)
number_of_entry.current(0)
number_of_entry.pack(side=tk.LEFT, padx=5)

search_button = tk.Button(top_frame,
                          text="Search",
                          command=search_materials,
                          width=10,
                          bg=rgb_color(255, 51, 153),
                          fg="black")
search_button.pack(side=tk.LEFT, padx=50)

export_button = tk.Button(top_frame,
                          text="to RavenDB",
                          command=export,
                          width=12,
                          bg=rgb_color(153, 255, 51),
                          fg="black")
export_button.pack(side=tk.LEFT, padx=50)

exit_button = tk.Button(top_frame,
                        text="Exit",
                        command=close_all,
                        width=15,
                        bg=rgb_color(253, 151, 151),
                        fg="black")
exit_button.pack(side=tk.LEFT, padx=50)

# ----------------------------------------------------------------------------------------------------------------------
# TABLE
# ----------------------------------------------------------------------------------------------------------------------
columns = {"Select": 50,
           "ID": 220,
           "Date": 80,
           "Title": 350,
           "Elements": 80,
           "Authors": 270}

table = ttk.Treeview(window, columns=tuple(columns.keys()), show="headings")

for col in columns:
    table.heading(col, text=col)
    table.column(col, width=columns[col])

table.heading("Select", text="☐")

table.pack(fill="both", expand=True, padx=10, pady=10)

scrollbar = ttk.Scrollbar(window, orient="vertical", command=table.yview)
table.configure(yscroll=scrollbar.set)
scrollbar.pack(side="right", fill="y")

table.bind("<Button-1>", toggle_checkbox)

# ----------------------------------------------------------------------------------------------------------------------
# Run
# ----------------------------------------------------------------------------------------------------------------------
window.mainloop()