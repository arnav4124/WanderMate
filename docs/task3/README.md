For adding diagrams in task 3 report:

1) Create .puml
2) Go to this <https://www.planttext.com/> and download pdf or svg
3) If downloaded svg Run this to convert svg to pdfs: python3 -c "import cairosvg, glob; [cairosvg.svg2pdf(url=f, write_to=f.replace('.svg','.pdf')) for f in glob.glob('*.svg')]"
4) Update latex code to include pdfs as graphics, ex) \includegraphics[width=0.65\textwidth]{caching_flow.pdf}
