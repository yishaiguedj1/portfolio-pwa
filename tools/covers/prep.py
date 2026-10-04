# שלב 1 של הדיוקן: חיתוך + הגדלה פי 4 + הפרדה מהרקע (rembg, u2net_human_seg).
# שימוש: python3 prep.py <תיקיית עבודה> <תמונת המקור>   (התמונה של המשתמש — לא בריפו: זכויות יוצרים)
# דרישות: pip install "rembg[cpu]" scikit-image scipy
import sys
from PIL import Image
from rembg import remove, new_session
S, src = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
im = im.crop((150, 0, im.width, im.height))           # לתמונה של 559x315: הפנים בצד ימין
im = im.resize((im.width * 4, im.height * 4), Image.LANCZOS)
im.save(S + '/crop2.jpg', quality=95)
remove(im, session=new_session('u2net_human_seg'), only_mask=True).save(S + '/mask2.png')
