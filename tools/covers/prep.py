# שלב 1 של הדיוקן: חיתוך + הגדלה פי 4 + הפרדה מהרקע (rembg, u2net_human_seg).
# שימוש: python3 prep.py <תיקיית עבודה> <תמונת המקור> [x0,y0,x1,y1]   (התמונה של המשתמש — לא בריפו: זכויות יוצרים)
#   אזור החיתוך: ברירת המחדל — באפט (559x315, הפנים בצד ימין). בזוס (שער Fortune 672x846): 180,150,520,520
# דרישות: pip install "rembg[cpu]" scikit-image scipy
import sys
from PIL import Image
from rembg import remove, new_session
S, src = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
box = tuple(int(v) for v in sys.argv[3].split(',')) if len(sys.argv) > 3 else (150, 0, im.width, im.height)
im = im.crop(box)
im = im.resize((im.width * 4, im.height * 4), Image.LANCZOS)
im.save(S + '/crop2.jpg', quality=95)
remove(im, session=new_session('u2net_human_seg'), only_mask=True).save(S + '/mask2.png')
