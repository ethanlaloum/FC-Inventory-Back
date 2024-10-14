import csv

input_file = 'db_fixed.csv'
output_file = 'db_fixed_quoted.csv'

with open(input_file, 'r', newline='', encoding='utf-8') as infile, \
     open(output_file, 'w', newline='', encoding='utf-8') as outfile:

    # Utiliser le Sniffer pour détecter automatiquement le format du CSV
    dialect = csv.Sniffer().sniff(infile.read(1024))
    infile.seek(0)

    reader = csv.reader(infile, dialect)
    writer = csv.writer(outfile, dialect='unix', quoting=csv.QUOTE_ALL)

    # Écrire toutes les lignes dans le nouveau fichier
    for row in reader:
        writer.writerow(row)

print(f"Le fichier a été traité et sauvegardé sous {output_file}")